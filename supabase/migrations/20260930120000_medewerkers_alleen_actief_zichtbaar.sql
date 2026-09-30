-- Alleen medewerkers met Easyflex2go-status Actief staan in de planning. Ingeschreven telde eerst
-- ook mee; de koppeling (easyflex-sync) zet `actief` nu alleen bij status Actief.
-- Eenmalig: huidige stand toepassen.
update public.ef_flexkrachten set actief = false where actief and ef_status <> 'Actief';

update public.medewerkers m set actief = false
where m.bron = 'easyflex' and m.actief
  and not exists (select 1 from public.ef_flexkrachten f where f.medewerker_id = m.id and f.actief);

insert into public.wijzigingen (omschrijving, tabel)
select format('Medewerkers verborgen die niet op Actief staan in Easyflex2go; zichtbaar: %s van %s', count(*) filter (where actief), count(*)), 'medewerkers'
from public.medewerkers where bron = 'easyflex';
