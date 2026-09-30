-- Opdrachtgever verbergen in de keuzelijsten van de planning (bijv. interne relaties
-- zoals de Solestus-BV's of "Test Relatie"). Los van `actief`, want dat zet de
-- Easyflex2go-koppeling bij elke synchronisatie opnieuw.
alter table public.opdrachtgevers add column if not exists verborgen boolean not null default false;
comment on column public.opdrachtgevers.verborgen is 'Door een planner verborgen: niet kiesbaar in de planning. De koppeling laat dit veld staan.';
