-- Voornaam, tussenvoegsel en achternaam uit Easyflex2go (first_name, insertion, last_name).
-- Easyflex2go is leidend: de koppeling vult ze, planners kunnen ze niet wijzigen.
alter table public.medewerkers
  add column if not exists voornaam text,
  add column if not exists tussenvoegsel text,
  add column if not exists achternaam text;

create or replace function public.bescherm_easyflex_velden() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.bron = 'easyflex' and (select auth.role()) <> 'service_role' then
    new.bron := old.bron;
    new.ef_registratienummer := old.ef_registratienummer;
    new.ef_id := old.ef_id;
    new.naam := old.naam;
    new.voornaam := old.voornaam;
    new.tussenvoegsel := old.tussenvoegsel;
    new.achternaam := old.achternaam;
    new.nationaliteit := old.nationaliteit;
    new.groep := old.groep;
    new.bv := old.bv;
    new.ef_status := old.ef_status;
    new.actief := old.actief;
    new.laatst_gesynchroniseerd := old.laatst_gesynchroniseerd;
  end if;
  new.gewijzigd_op := now();
  return new;
end;
$$;

create or replace function public.medewerkers_samenvoegen(groepen jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $function$
declare
  g jsonb;
  leden jsonb;
  ids bigint[];
  bestaand uuid[];
  doel uuid;
  beste jsonb;
  samengevoegd int := 0;
  nu timestamptz := now();
begin
  for g in select * from jsonb_array_elements(groepen) loop
    leden := g->'leden';
    select array_agg((l->>'id')::bigint order by (l->>'id')::bigint) into ids from jsonb_array_elements(leden) l;
    select l into beste from jsonb_array_elements(leden) l
      order by (l->>'rang')::int desc, (l->>'id')::bigint desc limit 1;

    select array_agg(distinct medewerker_id) into bestaand from public.ef_flexkrachten where ef_id = any(ids);
    if bestaand is null then
      insert into public.medewerkers (bron, ef_id, naam, groep, actief)
      values ('easyflex', ids[1], beste->>'naam', (beste->>'groep')::public.medewerker_groep, false)
      returning id into doel;
    else
      select m.id into doel from unnest(bestaand) m(id)
        order by (select count(*) from public.vakken v where v.medewerker_id = m.id)
               + (select count(*) from public.scania_ritten r where r.chauffeur_id = m.id) desc, m.id limit 1;
      if array_length(bestaand, 1) > 1 then
        -- Planning overzetten; bij botsingen wint wat al bij de doel-medewerker staat.
        delete from public.vakken v where v.medewerker_id = any(bestaand) and v.medewerker_id <> doel
          and exists (select 1 from public.vakken d where d.medewerker_id = doel and d.datum = v.datum);
        update public.vakken set medewerker_id = doel where medewerker_id = any(bestaand) and medewerker_id <> doel;
        delete from public.week_opmerkingen w where w.medewerker_id = any(bestaand) and w.medewerker_id <> doel
          and exists (select 1 from public.week_opmerkingen d where d.medewerker_id = doel and d.jaar = w.jaar and d.week = w.week);
        update public.week_opmerkingen set medewerker_id = doel where medewerker_id = any(bestaand) and medewerker_id <> doel;
        update public.afwezigheid set medewerker_id = doel where medewerker_id = any(bestaand) and medewerker_id <> doel;
        update public.scania_ritten set chauffeur_id = doel where chauffeur_id = any(bestaand) and chauffeur_id <> doel;
        update public.ef_flexkrachten set medewerker_id = doel where medewerker_id = any(bestaand);
        delete from public.medewerkers where id = any(bestaand) and id <> doel;
        samengevoegd := samengevoegd + array_length(bestaand, 1) - 1;
      end if;
    end if;

    insert into public.ef_flexkrachten (ef_id, medewerker_id, registratienummer, werkmaatschappij, ef_status, actief, laatst_gesynchroniseerd)
    select (l->>'id')::bigint, doel, nullif(l->>'regnr', ''), l->>'wm', l->>'status', (l->>'actief')::boolean, nu from jsonb_array_elements(leden) l
    on conflict (ef_id) do update set medewerker_id = excluded.medewerker_id, registratienummer = excluded.registratienummer,
      werkmaatschappij = excluded.werkmaatschappij, ef_status = excluded.ef_status, actief = excluded.actief, laatst_gesynchroniseerd = nu;

    update public.medewerkers set
      bron = 'easyflex',
      ef_id = ids[1],
      ef_registratienummer = nullif(beste->>'regnr', ''),
      naam = beste->>'naam',
      voornaam = nullif(trim(beste->>'voornaam'), ''),
      tussenvoegsel = nullif(trim(beste->>'tussenvoegsel'), ''),
      achternaam = nullif(trim(beste->>'achternaam'), ''),
      nationaliteit = nullif(beste->>'nat', ''),
      groep = (beste->>'groep')::public.medewerker_groep,
      bv = beste->>'wm',
      ef_status = beste->>'status',
      werkmaatschappijen = (select coalesce(array_agg(distinct l->>'wm') filter (where (l->>'actief')::boolean and l->>'wm' is not null), '{}') from jsonb_array_elements(leden) l),
      certificaten = (select coalesce(array_agg(distinct c), '{}') from jsonb_array_elements(leden) l, jsonb_array_elements_text(l->'certificaten') c),
      actief = exists (select 1 from jsonb_array_elements(leden) l where (l->>'actief')::boolean),
      laatst_gesynchroniseerd = nu
    where id = doel;
  end loop;

  -- Records die niet meer in Easyflex2go staan
  delete from public.ef_flexkrachten where laatst_gesynchroniseerd < nu;
  update public.medewerkers m set actief = false
    where m.bron = 'easyflex' and not exists (select 1 from public.ef_flexkrachten f where f.medewerker_id = m.id);

  return jsonb_build_object('medewerkers', (select count(*) from public.medewerkers where bron = 'easyflex'),
                            'actief', (select count(*) from public.medewerkers where bron = 'easyflex' and actief),
                            'samengevoegd', samengevoegd);
end;
$function$;
