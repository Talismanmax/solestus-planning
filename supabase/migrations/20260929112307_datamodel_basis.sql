-- Solestus Planning: basis datamodel
create type public.medewerker_bron as enum ('easyflex', 'handmatig');
create type public.medewerker_groep as enum ('nl', 'int', 'kantoor');
create type public.vak_status as enum ('werk','kantoor','thuiswerk','opleiding','niet_ingezet','nbb','thuis','vakantie','vrij','ziek','einde');
create type public.rit_dienst as enum ('dag','nacht');
create type public.rit_route as enum ('ishoj','rade');
create type public.gebruiker_rol as enum ('planner','lezer');

-- Gebruikers (kantoor, via Microsoft)
create table public.gebruikers (
  id uuid primary key references auth.users(id) on delete cascade,
  naam text,
  email text not null,
  rol public.gebruiker_rol not null default 'lezer',
  aangemaakt_op timestamptz not null default now()
);

-- Medewerkers
create table public.medewerkers (
  id uuid primary key default gen_random_uuid(),
  bron public.medewerker_bron not null,
  ef_registratienummer text unique,
  ef_id bigint unique,
  naam text not null,
  nationaliteit text,
  groep public.medewerker_groep not null,
  bv text,
  ef_status text,
  certificaten text[] not null default '{}',
  telefoon text,
  vaste_inzet jsonb,
  volgorde integer not null default 0,
  actief boolean not null default true,
  laatst_gesynchroniseerd timestamptz,
  aangemaakt_op timestamptz not null default now(),
  gewijzigd_op timestamptz not null default now(),
  constraint handmatig_is_kantoor check (bron = 'easyflex' or groep = 'kantoor')
);

-- Opdrachtgevers
create table public.opdrachtgevers (
  id uuid primary key default gen_random_uuid(),
  ef_relatie_id bigint unique,
  naam text not null,
  plaats text,
  korte_naam text,
  actief boolean not null default true,
  laatst_gesynchroniseerd timestamptz,
  aangemaakt_op timestamptz not null default now(),
  gewijzigd_op timestamptz not null default now()
);

-- Vakken: 1 per medewerker per dag
create table public.vakken (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerkers(id) on delete cascade,
  datum date not null,
  status public.vak_status not null,
  opdrachtgever_id uuid references public.opdrachtgevers(id),
  notitie text,
  gewijzigd_door uuid references public.gebruikers(id),
  gewijzigd_op timestamptz not null default now(),
  unique (medewerker_id, datum),
  constraint werk_heeft_opdrachtgever check (status <> 'werk' or opdrachtgever_id is not null)
);
create index vakken_datum_idx on public.vakken (datum);

-- Opmerking per medewerker per week
create table public.week_opmerkingen (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerkers(id) on delete cascade,
  jaar integer not null,
  week integer not null check (week between 1 and 53),
  tekst text not null,
  gewijzigd_door uuid references public.gebruikers(id),
  gewijzigd_op timestamptz not null default now(),
  unique (medewerker_id, jaar, week)
);

-- Afwezigheid voor een periode
create table public.afwezigheid (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerkers(id) on delete cascade,
  soort public.vak_status not null check (soort in ('vakantie','vrij','ziek','nbb','einde')),
  van date not null,
  tot_en_met date not null,
  notitie text,
  gewijzigd_door uuid references public.gebruikers(id),
  gewijzigd_op timestamptz not null default now(),
  constraint periode_klopt check (van <= tot_en_met)
);
create index afwezigheid_periode_idx on public.afwezigheid (van, tot_en_met);

-- Scania-ritten
create table public.scania_ritten (
  id uuid primary key default gen_random_uuid(),
  vertrekdatum date not null,
  dienst public.rit_dienst not null,
  route public.rit_route not null,
  chauffeur_id uuid references public.medewerkers(id) on delete set null,
  notitie text,
  gewijzigd_door uuid references public.gebruikers(id),
  gewijzigd_op timestamptz not null default now()
);
create index scania_ritten_datum_idx on public.scania_ritten (vertrekdatum);

create table public.rit_delen (
  id uuid primary key default gen_random_uuid(),
  rit_id uuid not null references public.scania_ritten(id) on delete cascade,
  volgorde smallint not null default 1,
  van text not null,
  naar text not null,
  vertrek timestamptz not null,
  aankomst timestamptz not null,
  constraint rit_tijd_klopt check (vertrek < aankomst)
);

-- Wijzigingslog
create table public.wijzigingen (
  id bigint generated always as identity primary key,
  tijdstip timestamptz not null default now(),
  gebruiker_id uuid references public.gebruikers(id),
  omschrijving text not null,
  tabel text,
  record_id uuid
);
create index wijzigingen_tijdstip_idx on public.wijzigingen (tijdstip desc);

-- Log van de Easyflex2go-koppeling
create table public.koppeling_log (
  id bigint generated always as identity primary key,
  tijdstip timestamptz not null default now(),
  gelukt boolean not null,
  medewerkers_bijgewerkt integer not null default 0,
  opdrachtgevers_bijgewerkt integer not null default 0,
  foutmelding text
);

-- Hulpfuncties voor toegang (verplaatst naar schema private in de volgende migratie)
create or replace function public.is_gebruiker() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gebruikers g where g.id = (select auth.uid()));
$$;

create or replace function public.is_planner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gebruikers g where g.id = (select auth.uid()) and g.rol = 'planner');
$$;

-- Alleen @solestus.com-accounts krijgen een gebruikersrecord (standaard alleen lezen)
create or replace function public.nieuwe_gebruiker() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) like '%@solestus.com' then
    insert into public.gebruikers (id, naam, email)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email), lower(new.email))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
create trigger bij_nieuwe_gebruiker after insert on auth.users
  for each row execute function public.nieuwe_gebruiker();

-- Gegevens uit Easyflex2go zijn in de planning vergrendeld
create or replace function public.bescherm_easyflex_velden() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.bron = 'easyflex' and (select auth.role()) <> 'service_role' then
    new.bron := old.bron;
    new.ef_registratienummer := old.ef_registratienummer;
    new.ef_id := old.ef_id;
    new.naam := old.naam;
    new.nationaliteit := old.nationaliteit;
    new.groep := old.groep;
    new.bv := old.bv;
    new.ef_status := old.ef_status;
    new.actief := old.actief;
    new.laatst_gesynchroniseerd := old.laatst_gesynchroniseerd;
  end if;
  new.gewijzigd_op := now();
  return new;
end;
$$;
create trigger medewerkers_bescherm before update on public.medewerkers
  for each row execute function public.bescherm_easyflex_velden();

create or replace function public.bescherm_opdrachtgever_velden() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.ef_relatie_id is not null and (select auth.role()) <> 'service_role' then
    new.ef_relatie_id := old.ef_relatie_id;
    new.naam := old.naam;
    new.plaats := old.plaats;
    new.laatst_gesynchroniseerd := old.laatst_gesynchroniseerd;
  end if;
  new.gewijzigd_op := now();
  return new;
end;
$$;
create trigger opdrachtgevers_bescherm before update on public.opdrachtgevers
  for each row execute function public.bescherm_opdrachtgever_velden();

-- Row level security aan op alle tabellen (policies: zie volgende migratie)
alter table public.gebruikers enable row level security;
alter table public.medewerkers enable row level security;
alter table public.opdrachtgevers enable row level security;
alter table public.vakken enable row level security;
alter table public.week_opmerkingen enable row level security;
alter table public.afwezigheid enable row level security;
alter table public.scania_ritten enable row level security;
alter table public.rit_delen enable row level security;
alter table public.wijzigingen enable row level security;
alter table public.koppeling_log enable row level security;
