-- Hulpfuncties in een niet-publiek schema
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_gebruiker() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gebruikers g where g.id = (select auth.uid()));
$$;
create or replace function private.is_planner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gebruikers g where g.id = (select auth.uid()) and g.rol = 'planner');
$$;
revoke all on function private.is_gebruiker() from public, anon;
revoke all on function private.is_planner() from public, anon;
grant execute on function private.is_gebruiker() to authenticated;
grant execute on function private.is_planner() to authenticated;

revoke execute on function public.nieuwe_gebruiker() from public, anon, authenticated;

-- Iedere ingelogde Solestus-gebruiker mag lezen
create policy "lezen" on public.gebruikers for select to authenticated using ((select private.is_gebruiker()));

do $$
declare t text;
begin
  foreach t in array array['medewerkers','opdrachtgevers','vakken','week_opmerkingen','afwezigheid','scania_ritten','rit_delen','wijzigingen','koppeling_log'] loop
    execute format('create policy "lezen" on public.%I for select to authenticated using ((select private.is_gebruiker()));', t);
  end loop;
  -- Alleen planners schrijven in de planning
  foreach t in array array['vakken','week_opmerkingen','afwezigheid','scania_ritten','rit_delen'] loop
    execute format('create policy "planner voegt toe" on public.%I for insert to authenticated with check ((select private.is_planner()));', t);
    execute format('create policy "planner wijzigt" on public.%I for update to authenticated using ((select private.is_planner())) with check ((select private.is_planner()));', t);
    execute format('create policy "planner verwijdert" on public.%I for delete to authenticated using ((select private.is_planner()));', t);
  end loop;
end $$;

-- Handmatig toevoegen kan alleen voor kantoormedewerkers; Easyflex-velden zijn vergrendeld (trigger)
create policy "planner voegt kantoor toe" on public.medewerkers for insert to authenticated with check ((select private.is_planner()) and bron = 'handmatig');
create policy "planner wijzigt" on public.medewerkers for update to authenticated using ((select private.is_planner())) with check ((select private.is_planner()));
create policy "planner wijzigt" on public.opdrachtgevers for update to authenticated using ((select private.is_planner())) with check ((select private.is_planner()));
create policy "planner logt" on public.wijzigingen for insert to authenticated with check ((select private.is_planner()) and gebruiker_id = (select auth.uid()));

drop function if exists public.is_gebruiker();
drop function if exists public.is_planner();

-- Indexen op verwijzingen
create index on public.afwezigheid (medewerker_id);
create index on public.afwezigheid (gewijzigd_door);
create index on public.rit_delen (rit_id);
create index on public.scania_ritten (chauffeur_id);
create index on public.scania_ritten (gewijzigd_door);
create index on public.vakken (gewijzigd_door);
create index on public.vakken (opdrachtgever_id);
create index on public.week_opmerkingen (gewijzigd_door);
create index on public.wijzigingen (gebruiker_id);
