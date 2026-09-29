-- Status van de relatie in Easyflex2go (state: bijv. actief/inactief) opslaan,
-- per relatie en per opdrachtgever. Een opdrachtgever krijgt de "beste" status van
-- zijn relaties: actief als minstens één relatie actief is.
alter table public.ef_relaties add column if not exists ef_status text;
alter table public.opdrachtgevers add column if not exists ef_status text;
comment on column public.opdrachtgevers.ef_status is 'Status in Easyflex2go (state). Actief als minstens één gekoppelde relatie actief is.';

create or replace function public.ef_status_is_actief(status text) returns boolean
language sql immutable set search_path = '' as $$
  select lower(coalesce(status, '')) in ('active', 'actief');
$$;

create or replace function public.opdrachtgevers_samenvoegen(groepen jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  g jsonb;
  leden jsonb;
  ids bigint[];
  bestaand uuid[];
  doel uuid;
  eerste jsonb;
  samengevoegd int := 0;
  nu timestamptz := now();
begin
  for g in select * from jsonb_array_elements(groepen) loop
    leden := g->'leden';
    select array_agg((l->>'id')::bigint order by (l->>'id')::bigint) into ids from jsonb_array_elements(leden) l;
    select l into eerste from jsonb_array_elements(leden) l order by (l->>'id')::bigint limit 1;

    -- Welke opdrachtgevers horen nu al bij deze relaties?
    select array_agg(distinct opdrachtgever_id) into bestaand from public.ef_relaties where ef_relatie_id = any(ids);
    if bestaand is null then
      insert into public.opdrachtgevers (naam, actief) values (eerste->>'naam', true) returning id into doel;
    else
      -- Houd de opdrachtgever met de meeste planning; de rest gaat erin op.
      select o.id into doel from unnest(bestaand) o(id)
        order by (select count(*) from public.vakken v where v.opdrachtgever_id = o.id) desc, o.id limit 1;
      if array_length(bestaand, 1) > 1 then
        update public.vakken set opdrachtgever_id = doel where opdrachtgever_id = any(bestaand) and opdrachtgever_id <> doel;
        update public.ef_relaties set opdrachtgever_id = doel where opdrachtgever_id = any(bestaand);
        delete from public.opdrachtgevers where id = any(bestaand) and id <> doel;
        samengevoegd := samengevoegd + array_length(bestaand, 1) - 1;
      end if;
    end if;

    -- Koppelingen per Easyflex2go-relatie bijwerken
    insert into public.ef_relaties (ef_relatie_id, opdrachtgever_id, naam, werkmaatschappij, kvk_nummer, ef_status, laatst_gesynchroniseerd)
    select (l->>'id')::bigint, doel, l->>'naam', l->>'wm', nullif(l->>'kvk', '')::bigint, nullif(l->>'status', ''), nu from jsonb_array_elements(leden) l
    on conflict (ef_relatie_id) do update set opdrachtgever_id = excluded.opdrachtgever_id, naam = excluded.naam,
      werkmaatschappij = excluded.werkmaatschappij, kvk_nummer = excluded.kvk_nummer, ef_status = excluded.ef_status, laatst_gesynchroniseerd = nu;

    -- Gegevens van de opdrachtgever (vergrendelde velden alleen via deze functie)
    update public.opdrachtgevers set
      ef_relatie_id = ids[1],
      naam = eerste->>'naam',
      plaats = coalesce((select l->>'plaats' from jsonb_array_elements(leden) l where l->>'plaats' <> '' limit 1), plaats),
      kvk_nummer = (select nullif(l->>'kvk', '')::bigint from jsonb_array_elements(leden) l where nullif(l->>'kvk', '') is not null limit 1),
      werkmaatschappijen = (select coalesce(array_agg(distinct l->>'wm') filter (where l->>'wm' is not null), '{}') from jsonb_array_elements(leden) l),
      ef_status = coalesce(
        (select nullif(l->>'status', '') from jsonb_array_elements(leden) l
          where nullif(l->>'status', '') is not null
          order by public.ef_status_is_actief(l->>'status') desc limit 1),
        ef_status),
      actief = true,
      laatst_gesynchroniseerd = nu
    where id = doel;
  end loop;

  -- Relaties die niet meer in Easyflex2go staan
  delete from public.ef_relaties where laatst_gesynchroniseerd < nu;
  update public.opdrachtgevers o set actief = false
    where o.ef_relatie_id is not null and not exists (select 1 from public.ef_relaties r where r.opdrachtgever_id = o.id);

  return jsonb_build_object('opdrachtgevers', (select count(*) from public.opdrachtgevers where actief), 'samengevoegd', samengevoegd);
end;
$function$;

-- Velden uit Easyflex2go zijn in de planning vergrendeld (alleen de koppeling wijzigt ze).
create or replace function public.bescherm_opdrachtgever_velden() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.ef_relatie_id is not null and (select auth.role()) <> 'service_role' then
    new.ef_relatie_id := old.ef_relatie_id;
    new.naam := old.naam;
    new.plaats := old.plaats;
    new.kvk_nummer := old.kvk_nummer;
    new.werkmaatschappijen := old.werkmaatschappijen;
    new.ef_status := old.ef_status;
    new.actief := old.actief;
    new.laatst_gesynchroniseerd := old.laatst_gesynchroniseerd;
  end if;
  new.gewijzigd_op := now();
  return new;
end;
$$;
