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
- [x] Stamgegevens: overzicht, kantoormedewerker toevoegen
- [ ] Scania-ritten
- [ ] Overzicht
- [ ] Export (PDF en Excel)
- [ ] Koppeling Easyflex2go (tijdelijk via vast IP-adres)
