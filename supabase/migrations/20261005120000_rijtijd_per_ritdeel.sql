-- Rijtijd per deel van een Scania-rit, in minuten. Leeg = de standaard van de route (zie RIJTIJD in src/lib/rijtijden.ts).
-- De rijtijd is korter dan vertrek tot aankomst: pauzes, de veerboot en wachten tellen niet mee.
alter table public.rit_delen add column if not exists rijtijd_min smallint
  check (rijtijd_min is null or rijtijd_min between 0 and 1440);
