# Solestus Planning

Weekplanning voor chauffeurs en kantoor van Solestus. Alleen voor medewerkers van Solestus (inloggen met Microsoft, @solestus.com).

- **App:** Next.js (App Router) op Vercel
- **Database en inloggen:** Supabase, project `solestus-planning` (eu-central-1)
- **Bron van gegevens:** Easyflex2go is leidend voor chauffeurs (medewerkers). Kantoormedewerkers en opdrachtgevers beheren planners zelf in Stamgegevens. De groep van een chauffeur volgt uit de nationaliteit in Easyflex2go.

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

Migraties staan in `supabase/migrations`. Row level security staat aan op alle tabellen (ook `private.instellingen`).

- Anon heeft geen rechten op tabellen in `public`; ingelogde gebruikers lezen alles, alleen planners schrijven (uitzondering: het vinkje "verwerkt" in de verloning, alleen op eigen naam).
- `bron` en `ef_id` van medewerkers kan alleen de koppeling (service_role) wijzigen.
- `koppeling_log` wordt dagelijks opgeschoond (regels ouder dan 90 dagen, cron-taak `koppeling-log-opruimen`).
- De koppeling draait maximaal eens per 5 minuten (1 minuut na een mislukte poging); foutdetails staan in de logs van de edge function, niet in de tabel.

## Beveiliging

- Beveiligingsheaders in `next.config.ts` (geen iframes, nosniff, referrer- en permissions-policy).
- Excel-exports zetten een `'` voor tekst die met `= + - @` begint (geen formules).
- Zelf in te stellen: Azure-provider single-tenant (Tenant URL), e-mail/wachtwoord-provider uit in Supabase Auth, sessieduur 8 uur in Supabase Auth → Sessions.

## Status

- [x] Inloggen met Microsoft, uitloggen, sessie verlopen (ook na 8 uur niets doen; na opnieuw inloggen terug op dezelfde pagina)
- [x] Navigatiebalk met profielmenu
- [x] Weekplanning: vakken, opmerkingen per week, afwezigheid, legenda, wijzigingslog
- [x] Weekplanning: week- en dagweergave, meerdere vakken tegelijk (Ctrl/⌘/Shift-klik: bewerken, kopiëren, plakken, leegmaken), vorige week kopiëren, wijzigingenpaneel
- [x] Vaste inzet per medewerker (Stamgegevens → medewerker bewerken; weekplanning → Vaste inzet vult lege vakken)
- [x] Stamgegevens: overzicht, kantoormedewerker toevoegen, medewerker bewerken, opdrachtgevers zelf toevoegen/bewerken/verwijderen (korte naam in het rooster, verbergen in de planning, Scania-vinkje); niet-actieve medewerkers (alles behalve status Actief in Easyflex2go) automatisch verborgen; medewerkers ook zelf te verbergen met het vinkje Actief
- [x] Scania-ritten (opdrachtgever met het vinkje Scania), met standaardweek (`STANDAARDWEEK` in `src/lib/scania.ts`); extra opdrachten (bijv. pendelen) in violet
- [x] Rijtijden Scania-chauffeurs automatisch geteld (`src/lib/rijtijden.ts`): per week (max 56 u), per twee weken (max 90 u), per rijdag (max 9 u, 2× per week 10 u) en wekelijkse rust (24 u binnen 6 dagen). Rijtijd per ritdeel aanpasbaar; leeg = standaard (Ishøj 9 u per richting, Rade 8 u, extra opdracht: duur min 45 min pauze). Alleen Scania-ritten tellen mee.
- [x] Overzicht: kerncijfers, bezetting per opdrachtgever, beschikbaar en afwezig per dag
- [x] Afwezigheid voor een periode invoeren, wijzigen en verwijderen (vanuit Overzicht)
- [x] Export: PDF (weekplanning liggend/staand, Scania, overzicht) via afdrukpagina's onder `/afdruk`, Excel (weekplanning, bezetting)
- [x] Dark mode: Licht, Donker of Systeem via het profielmenu (per browser bewaard); PDF's blijven altijd licht
- [x] Verloning: per 4-wekenperiode (periode 1 = week 1–4 … periode 13 = week 49 t/m laatste week) de planning week voor week, met per medewerker een vinkje "verwerkt" (wie en wanneer) en filter per BV; voor iedereen die kan inloggen
- [x] Koppeling Easyflex2go: elk uur (ma–za) en met "Nu bijwerken" in Stamgegevens (alleen planners). De cron-taak stuurt een geheime sleutel mee uit `private.instellingen`.
- [x] Naam uit Microsoft bij inloggen (scope `openid email profile`; trigger vult een lege naam)
