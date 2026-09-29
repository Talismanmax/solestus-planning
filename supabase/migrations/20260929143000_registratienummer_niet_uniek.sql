-- In Easyflex2go kan hetzelfde registratienummer bij meer flexkrachtrecords voorkomen
-- (bijvoorbeeld per werkmaatschappij). Het Easyflex2go-id (ef_id) blijft de unieke sleutel.
alter table public.medewerkers drop constraint if exists medewerkers_ef_registratienummer_key;
create index if not exists medewerkers_ef_registratienummer_idx on public.medewerkers (ef_registratienummer);
