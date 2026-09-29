-- Namen in de planning als "Voornaam tussenvoegsel Achternaam" (was: de volledige naam uit
-- Easyflex2go, "Achternaam, tussenvoegsel (voorletters, voornaam)"). De koppeling doet dit
-- voortaan zelf; dit zet de huidige stand om. Zonder achternaam blijft de naam staan.
update public.medewerkers
set naam = concat_ws(' ', nullif(trim(voornaam), ''), nullif(trim(tussenvoegsel), ''), trim(achternaam))
where bron = 'easyflex' and nullif(trim(achternaam), '') is not null;
