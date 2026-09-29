create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Elk uur (05:05–19:05 UTC, ma–za) gegevens ophalen uit Easyflex2go via de edge function easyflex-sync.
-- De sleutel hieronder is de openbare anon-sleutel; de functie mag maximaal eens per 5 minuten draaien.
select cron.schedule(
  'easyflex-sync-elk-uur',
  '5 5-19 * * 1-6',
  $$
  select net.http_post(
    url := 'https://bqkniqrrlewxvehyqjby.supabase.co/functions/v1/easyflex-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
