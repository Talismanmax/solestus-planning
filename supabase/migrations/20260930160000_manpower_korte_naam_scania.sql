-- Manpower AB (de Scania-relatie) heet in de planning "Scania". Dat stond als vaste uitzondering
-- in de code; nu is het gewoon de korte naam, zichtbaar en aan te passen in Stamgegevens.
update public.opdrachtgevers set korte_naam = 'Scania'
where lower(naam) = 'manpower ab' and korte_naam is null;
