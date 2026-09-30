-- Verloning per 4-wekenperiode (periode 1 = week 1–4, …, periode 13 = week 49 t/m de laatste week).
-- Een rij betekent: deze medewerker is voor deze periode verwerkt. Uitvinken verwijdert de rij.
-- Iedereen die kan inloggen mag de verloning zien en afvinken.
create table if not exists public.verloning_verwerkt (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerkers(id) on delete cascade,
  jaar int not null,
  periode int not null check (periode between 1 and 13),
  verwerkt_door uuid references public.gebruikers(id) on delete set null,
  verwerkt_op timestamptz not null default now(),
  unique (medewerker_id, jaar, periode)
);
create index if not exists verloning_verwerkt_periode on public.verloning_verwerkt (jaar, periode);

alter table public.verloning_verwerkt enable row level security;
create policy "lezen" on public.verloning_verwerkt for select to authenticated using ((select private.is_gebruiker()));
create policy "gebruiker vinkt af" on public.verloning_verwerkt for insert to authenticated with check ((select private.is_gebruiker()));
create policy "gebruiker vinkt uit" on public.verloning_verwerkt for delete to authenticated using ((select private.is_gebruiker()));

-- Afvinken komt in het wijzigingenlog, ook als een lezer het doet (alleen voor deze tabel).
create policy "gebruiker logt verloning" on public.wijzigingen for insert to authenticated
  with check ((select private.is_gebruiker()) and gebruiker_id = (select auth.uid()) and tabel = 'verloning_verwerkt');
