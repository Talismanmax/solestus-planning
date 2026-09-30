-- Vastleggen wat alleen in de database stond (de oorspronkelijke migraties 20260929150000 en
-- 20260929153000 zijn in de repo alleen een verwijzing). Verandert niets aan een bestaande database.
-- De functie public.medewerkers_samenvoegen staat volledig in 20260930150000_medewerker_naamdelen.sql.

-- Eén rij per flexkrachtrecord in Easyflex2go; meerdere records van dezelfde persoon wijzen naar één medewerker.
create table if not exists public.ef_flexkrachten (
  ef_id bigint primary key,
  medewerker_id uuid not null references public.medewerkers(id) on delete cascade,
  registratienummer text,
  werkmaatschappij text,
  ef_status text,
  actief boolean not null default false,
  laatst_gesynchroniseerd timestamptz not null default now()
);
create index if not exists ef_flexkrachten_medewerker_id_idx on public.ef_flexkrachten (medewerker_id);
alter table public.ef_flexkrachten enable row level security;
drop policy if exists "lezen" on public.ef_flexkrachten;
create policy "lezen" on public.ef_flexkrachten for select to authenticated using ((select private.is_gebruiker()));

-- Alleen de koppeling (service_role) mag samenvoegen.
revoke all on function public.medewerkers_samenvoegen(jsonb) from public, anon, authenticated;
grant execute on function public.medewerkers_samenvoegen(jsonb) to service_role;
