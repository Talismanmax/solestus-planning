# Solestus Planning

Weekplanning voor chauffeurs en kantoor van Solestus. Alleen voor medewerkers van Solestus (inloggen met Microsoft, @solestus.com).

- **App:** Next.js (App Router) op Vercel
- **Database en inloggen:** Supabase, project `solestus-planning` (eu-central-1)
- **Bron van gegevens:** Easyflex2go is leidend voor medewerkers en opdrachtgevers. Kantoormedewerkers worden handmatig toegevoegd. De groep van een chauffeur volgt uit de nationaliteit in Easyflex2go.

## Lokaal draaien

```bash
cp .env.example .env.local   # vul de publishable key in
npm install
npm run dev
```

## Rollen

- `lezer` (standaard voor iedere nieuwe gebruiker): alles bekijken.
- `planner`: planning wijzigen, kantoormedewerkers toevoegen. Rol aanpassen in Supabase, tabel `gebruikers`.

## Database

Migraties staan in `supabase/migrations`. Row level security staat aan op alle tabellen.

## Status

- [x] Inloggen met Microsoft, uitloggen, sessie verlopen (ook na 8 uur niets doen; na opnieuw inloggen terug op dezelfde pagina)
- [x] Navigatiebalk met profielmenu
- [x] Weekplanning: vakken, opmerkingen per week, afwezigheid, legenda, wijzigingslog
- [x] Weekplanning: week- en dagweergave, meerdere vakken tegelijk (Ctrl/⌘/Shift-klik: bewerken, kopiëren, plakken, leegmaken), vorige week kopiëren, wijzigingenpaneel
- [x] Vaste inzet per medewerker (Stamgegevens → medewerker bewerken; weekplanning → Vaste inzet vult lege vakken)
- [x] Stamgegevens: overzicht, kantoormedewerker toevoegen, medewerker bewerken, opdrachtgever bewerken (korte naam in het rooster, verbergen in de planning); status uit Easyflex2go, niet-actieve relaties en medewerkers (alles behalve status Actief) automatisch verborgen
- [x] Scania-ritten (Easyflex2go-relatie Manpower AB)
- [x] Overzicht: kerncijfers, bezetting per opdrachtgever, beschikbaar en afwezig per dag
- [x] Afwezigheid voor een periode invoeren, wijzigen en verwijderen (vanuit Overzicht)
- [x] Export: PDF (weekplanning liggend/staand, Scania, overzicht) via afdrukpagina's onder `/afdruk`, Excel (weekplanning, bezetting)
- [x] Koppeling Easyflex2go: elk uur (ma–za) en met "Nu bijwerken" in Stamgegevens (alleen planners). De cron-taak stuurt een geheime sleutel mee uit `private.instellingen`.
- [x] Naam uit Microsoft bij inloggen (scope `openid email profile`; trigger vult een lege naam)
