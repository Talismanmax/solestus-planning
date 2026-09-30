-- Niet-actieve relaties (Easyflex2go-status Passief, Verloren, Doelgroep, Prospect) zijn
-- niet kiesbaar in de planning. De koppeling zet `verborgen` bij een nieuwe opdrachtgever
-- en telkens als de status in Easyflex2go verandert; een handmatige keuze in Stamgegevens
-- blijft staan tot de volgende statuswijziging.

create or replace function public.opdrachtgever_verborgen_volgt_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ef_status is not null and (tg_op = 'INSERT' or new.ef_status is distinct from old.ef_status) then
    new.verborgen := not public.ef_status_is_actief(new.ef_status);
  end if;
  return new;
end;
$$;

drop trigger if exists opdrachtgevers_verborgen_volgt_status on public.opdrachtgevers;
create trigger opdrachtgevers_verborgen_volgt_status before insert or update of ef_status on public.opdrachtgevers
  for each row execute function public.opdrachtgever_verborgen_volgt_status();

-- Eenmalig: huidige stand toepassen.
update public.opdrachtgevers set verborgen = true
where ef_relatie_id is not null and ef_status is not null and not public.ef_status_is_actief(ef_status);

-- Eenmalig: interne relaties verbergen, ook als ze in Easyflex2go actief zijn.
update public.opdrachtgevers set verborgen = true
where naam ilike 'solestus %' or naam in ('Test Relatie', 'Uitbetaling reserveringen');

insert into public.wijzigingen (omschrijving, tabel)
select format('Opdrachtgevers verborgen die niet actief zijn in Easyflex2go of intern zijn: %s van %s', count(*) filter (where verborgen), count(*)), 'opdrachtgevers'
from public.opdrachtgevers where actief;
