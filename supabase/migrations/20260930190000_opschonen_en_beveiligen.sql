-- Controle van de hele tool: beveiliging aanscherpen en opschonen.

-- 1. Extra slot op de instellingen (sync-sleutel). Er zijn geen rechten voor anon/authenticated;
--    security-definer-functies lezen de tabel als eigenaar en blijven werken.
alter table private.instellingen enable row level security;

-- 2. Niet-ingelogde bezoekers hebben niets te zoeken in de tabellen: de app vraagt alles op als ingelogde gebruiker.
--    TRUNCATE/TRIGGER/REFERENCES vallen niet onder RLS; ook voor ingelogde gebruikers weghalen.
revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;

-- 3. Afvinken in de verloning alleen op eigen naam.
drop policy if exists "gebruiker vinkt af" on public.verloning_verwerkt;
create policy "gebruiker vinkt af" on public.verloning_verwerkt for insert to authenticated
  with check ((select private.is_gebruiker()) and verwerkt_door = (select auth.uid()));
create index if not exists verloning_verwerkt_verwerkt_door on public.verloning_verwerkt (verwerkt_door);

-- 4. Eén insert-policy op het wijzigingenlog: planners loggen alles, andere gebruikers alleen de verloning.
drop policy if exists "planner logt" on public.wijzigingen;
drop policy if exists "gebruiker logt verloning" on public.wijzigingen;
create policy "gebruiker logt" on public.wijzigingen for insert to authenticated
  with check (
    gebruiker_id = (select auth.uid())
    and ((select private.is_planner()) or ((select private.is_gebruiker()) and tabel = 'verloning_verwerkt'))
  );

-- 5. Herkomst en Easyflex-id van een medewerker kan alleen de koppeling wijzigen (ook bij handmatige medewerkers).
create or replace function public.bescherm_easyflex_velden() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then
    new.bron := old.bron;
    new.ef_id := old.ef_id;
    if old.bron = 'easyflex' then
      new.ef_registratienummer := old.ef_registratienummer;
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
  end if;
  new.gewijzigd_op := now();
  return new;
end;
$$;

-- 6. Koppelingslog: regels ouder dan 90 dagen dagelijks opruimen.
select cron.unschedule('koppeling-log-opruimen') where exists (select 1 from cron.job where jobname = 'koppeling-log-opruimen');
select cron.schedule('koppeling-log-opruimen', '17 3 * * *', $$delete from public.koppeling_log where tijdstip < now() - interval '90 days'$$);

-- 7. Testgegevens weg.
delete from public.afwezigheid where notitie = 'Test Vakantie';
