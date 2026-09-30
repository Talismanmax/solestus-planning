-- Extra opdracht van Scania naast de vaste ritten (bijv. pendelen): route 'extra' met een eigen
-- omschrijving. De delen (van, naar, tijden) zijn vrij in te vullen.
alter type public.rit_route add value if not exists 'extra';
alter table public.scania_ritten add column if not exists omschrijving text;
