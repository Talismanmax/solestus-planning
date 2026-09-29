-- De koppeling (edge function easyflex-sync) mag alleen worden gestart door
--   1. de uurlijkse cron-taak, met een geheime sleutel die alleen in de database staat, of
--   2. een ingelogde planner (knop "Nu bijwerken" in Stamgegevens).
-- Daarvoor kon iedereen met de openbare anon-sleutel de koppeling starten.

create table if not exists private.instellingen (
  naam text primary key,
  waarde text not null
);
revoke all on private.instellingen from public, anon, authenticated;

insert into private.instellingen (naam, waarde)
values ('easyflex_sync_sleutel', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (naam) do nothing;

create or replace function public.easyflex_sync_sleutel_klopt(sleutel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.instellingen i where i.naam = 'easyflex_sync_sleutel' and i.waarde = sleutel);
$$;
revoke all on function public.easyflex_sync_sleutel_klopt(text) from public, anon, authenticated;
grant execute on function public.easyflex_sync_sleutel_klopt(text) to service_role;

-- Cron-taak: stuur de sleutel mee (de rest van de aanroep blijft gelijk).
select cron.alter_job(
  job_id := j.jobid,
  command := replace(j.command, '''Authorization''',
    '''x-sync-sleutel'', (select waarde from private.instellingen where naam = ''easyflex_sync_sleutel''), ''Authorization''')
)
from cron.job j
where j.jobname = 'easyflex-sync-elk-uur' and j.command not like '%x-sync-sleutel%';
