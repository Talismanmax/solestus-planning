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

- [x] Inloggen met Microsoft, uitloggen, sessie verlopen
- [x] Navigatiebalk met profielmenu
- [x] Weekplanning: vakken, opmerkingen per week, afwezigheid, legenda, wijzigingslog
- [x] Weekplanning: week- en dagweergave, meerdere vakken tegelijk (Ctrl/⌘/Shift-klik: bewerken, kopiëren, plakken, leegmaken), vorige week kopiëren, wijzigingenpaneel
- [ ] Vaste inzet per medewerker
- [x] Stamgegevens: overzicht, kantoormedewerker toevoegen
- [x] Scania-ritten (Easyflex2go-relatie Manpower AB)
- [x] Overzicht: kerncijfers, bezetting per opdrachtgever, beschikbaar en afwezig per dag
- [x] Afwezigheid voor een periode invoeren, wijzigen en verwijderen (vanuit Overzicht)
- [x] Export: PDF (weekplanning liggend/staand, Scania, overzicht) via afdrukpagina's onder `/afdruk`, Excel (weekplanning, bezetting)
- [ ] Koppeling Easyflex2go (tijdelijk via vast IP-adres)
