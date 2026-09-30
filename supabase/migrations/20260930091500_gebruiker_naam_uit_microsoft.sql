-- Naam uit Microsoft overnemen. Supabase werkt raw_user_meta_data bij elke login bij;
-- de app vraagt daarvoor de scopes "openid email profile" (zie InlogKnop.tsx).
-- Alleen als de naam nog leeg is of gelijk is aan het e-mailadres: een handmatig
-- ingestelde naam blijft staan.
create or replace function public.gebruiker_naam_bijwerken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nieuwe_naam text := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')), '');
begin
  if nieuwe_naam is not null and nieuwe_naam not like '%@%' then
    update public.gebruikers g
    set naam = nieuwe_naam
    where g.id = new.id and (g.naam is null or g.naam = '' or lower(g.naam) = lower(g.email));
  end if;
  return new;
end;
$$;

drop trigger if exists bij_login_naam on auth.users;
create trigger bij_login_naam after update of raw_user_meta_data on auth.users
  for each row execute function public.gebruiker_naam_bijwerken();

revoke all on function public.gebruiker_naam_bijwerken() from public, anon, authenticated;
