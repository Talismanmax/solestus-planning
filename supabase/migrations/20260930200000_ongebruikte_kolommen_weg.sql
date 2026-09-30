-- Opdrachtgevers worden zelf beheerd (niet meer uit Easyflex2go): actief was altijd true
-- en de koppeling telt geen opdrachtgevers meer.
alter table public.opdrachtgevers drop column if exists actief;
alter table public.koppeling_log drop column if exists opdrachtgevers_bijgewerkt;
