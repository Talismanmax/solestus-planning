-- Opdrachtgevers komen niet meer uit Easyflex2go: planners maken ze zelf aan en beheren ze in
-- Stamgegevens. De koppeling (easyflex-sync v19) haalt alleen nog medewerkers op.

-- Easyflex2go-regels voor opdrachtgevers weg
drop trigger if exists opdrachtgevers_bescherm on public.opdrachtgevers;
drop trigger if exists opdrachtgevers_verborgen_volgt_status on public.opdrachtgevers;
drop function if exists public.bescherm_opdrachtgever_velden();
drop function if exists public.opdrachtgever_verborgen_volgt_status();
drop function if exists public.opdrachtgevers_samenvoegen(jsonb);
drop function if exists public.ef_status_is_actief(text);
drop table if exists public.ef_relaties;

-- Scania-opdrachtgever aan een vinkje herkennen in plaats van aan de naam "Manpower AB"
alter table public.opdrachtgevers add column if not exists scania boolean not null default false;
create unique index if not exists opdrachtgevers_een_scania on public.opdrachtgevers (scania) where scania;
update public.opdrachtgevers set scania = true where lower(naam) = 'manpower ab';

-- Verborgen Easyflex2go-relaties die nergens in de planning voorkomen, opruimen
with weg as (
  delete from public.opdrachtgevers o
  where o.verborgen and not o.scania
    and not exists (select 1 from public.vakken v where v.opdrachtgever_id = o.id)
    and not exists (select 1 from public.medewerkers m where m.vaste_inzet->>'opdrachtgever_id' = o.id::text)
  returning 1
)
insert into public.wijzigingen (omschrijving, tabel)
select format('Opdrachtgevers worden voortaan zelf beheerd; %s verborgen Easyflex2go-relaties opgeruimd', count(*)), 'opdrachtgevers' from weg;

-- Kolommen die alleen voor Easyflex2go waren
alter table public.opdrachtgevers
  drop column if exists ef_relatie_id,
  drop column if exists ef_status,
  drop column if exists kvk_nummer,
  drop column if exists werkmaatschappijen,
  drop column if exists laatst_gesynchroniseerd;

-- Wijzigdatum bijhouden (deed eerst de beschermingstrigger)
create or replace function public.opdrachtgever_gewijzigd() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.gewijzigd_op := now();
  return new;
end;
$$;
drop trigger if exists opdrachtgevers_gewijzigd on public.opdrachtgevers;
create trigger opdrachtgevers_gewijzigd before update on public.opdrachtgevers
  for each row execute function public.opdrachtgever_gewijzigd();

-- Planners mogen opdrachtgevers toevoegen en verwijderen (bijwerken mocht al)
drop policy if exists "planner voegt toe" on public.opdrachtgevers;
create policy "planner voegt toe" on public.opdrachtgevers for insert to authenticated
  with check ((select private.is_planner()));
drop policy if exists "planner verwijdert" on public.opdrachtgevers;
create policy "planner verwijdert" on public.opdrachtgevers for delete to authenticated
  using ((select private.is_planner()));
