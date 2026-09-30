-- Een planner kan een medewerker uit Easyflex2go verbergen in de planning, ook als die daar Actief is.
-- `actief` blijft van de koppeling (status in Easyflex2go); `verborgen` is een eigen keuze en wordt
-- door de koppeling niet aangeraakt. In de planning staat wie actief is en niet verborgen.
alter table public.medewerkers add column if not exists verborgen boolean not null default false;
