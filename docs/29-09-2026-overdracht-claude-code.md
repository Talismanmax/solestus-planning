# Overdracht Solestus Planning → Claude Code (29-09-2026)

Lees dit eerst. Het beschrijft de stand van zaken, waar alles draait en wat nog open staat.

## Waar draait wat

| Onderdeel | Waar | Details |
|---|---|---|
| Code | GitHub `talismanmax/solestus-planning` | Branch `main`. Tot nu toe niet gepusht (de vorige sessie had geen schrijfrechten); alle commits zitten in deze map. |
| App | Vercel, project `solestus-planning` | https://solestus-planning.vercel.app — Hobby-plan (tijdelijk, voor zakelijk gebruik later naar Pro). Tot nu toe gepubliceerd zonder Git-koppeling. |
| Database, inloggen, koppeling | Supabase, project `solestus-planning` | ref `bqkniqrrlewxvehyqjby`, regio eu-central-1, gratis plan |
| Inloggen | Microsoft Entra ID via Supabase Auth (provider Azure) | Tenant `8cdbd764-2916-4cb7-af23-a43ccb9ecb2a`, client `8e6ae02c-f204-4ef6-b870-d339afd8f9b7`. Alleen `@solestus.com`. |
| Easyflex2go | https://solestus.easyflex2go.nl/api/v1 | API-docs: https://solestus.easyflex2go.nl/docs/api |

## Eerste stappen in Claude Code

1. Push de bestaande commits: `git push -u origin main`.
2. Koppel in Vercel het project `solestus-planning` aan de GitHub-repo (Settings → Git). Daarna publiceert elke push naar `main` automatisch.
   Omgevingsvariabelen staan al in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Supabase CLI: `supabase link --project-ref bqkniqrrlewxvehyqjby` en daarna `supabase migration fetch`.
   **Let op:** de bestanden in `supabase/migrations/` zijn met de hand bijgehouden en komen niet overal overeen met de database (andere versienummers; twee bestanden zijn alleen een beschrijving). De migraties in Supabase zelf zijn leidend. Vervang de map door wat `migration fetch` ophaalt.
4. Lokaal draaien: `cp .env.example .env.local` (publishable key invullen), `npm install`, `npm run dev`.

## Techniek

- Next.js 16 (App Router). Middleware heet in deze versie `src/proxy.ts`. Zie ook `AGENTS.md`.
- Supabase via `@supabase/ssr`; RLS staat aan op alle tabellen. Hulpfuncties `private.is_gebruiker()` en `private.is_planner()`.
- Rollen in tabel `gebruikers`: `lezer` (standaard) en `planner`. Max (m.zomer@solestus.com) is planner.
- Lettertypen: Fustat en Zilla Slab via Google Fonts, PP Neue Machina als subset in `public/fonts/`. Logo's in `public/logo/` (uit het Solestus design system).
- Tijden: altijd Europe/Amsterdam, hulpfuncties in `src/lib/tijd.ts`.

## Koppeling Easyflex2go

- Edge function `easyflex-sync` (code in `supabase/functions/easyflex-sync/`). Draait elk uur via pg_cron-taak `easyflex-sync-elk-uur` (ma–za, 05:05–19:05 UTC), maximaal eens per 5 minuten. Body `{"test": true}` doet alleen een testaanvraag.
- De HTTP-aanvragen gaan via databasefunctie `public.easyflex_ophalen` (extensie `http`), zodat ze van het vaste uitgaande IP van de database komen: **63.186.227.188**. Dat adres staat op de IP-whitelist van het token. Verandert het (bijv. na pauzeren van het project), dan het nieuwe adres whitelisten: `select (extensions.http_get('https://api.ipify.org')).content;`
- Secrets (Supabase → Edge Functions → Secrets): `EASYFLEX_API_TOKEN` (tenant-token, alleen lezen), optioneel `EASYFLEX_FROM` (standaard m.zomer@solestus.com).
- Samenvoegen:
  - Flexkrachten met hetzelfde registratienummer → één medewerker (`public.medewerkers_samenvoegen`, koppeltabel `ef_flexkrachten`).
  - Relaties met dezelfde naam (zonder leestekens) of hetzelfde KvK-nummer → één opdrachtgever (`public.opdrachtgevers_samenvoegen`, koppeltabel `ef_relaties`).
- Groep volgt uit nationaliteit: NL (of leeg) → Chauffeurs NL, anders Chauffeurs internationaal. Kantoormedewerkers worden handmatig toegevoegd.
- Actief = status Actief of Ingeschreven bij minstens één werkmaatschappij.
- Laatste run: 357 flexkrachtrecords → 320 medewerkers (67 actief); 146 relaties → 106 opdrachtgevers.

## Wat werkt

- Inloggen/uitloggen met Microsoft, sessie verlopen, navigatiebalk met profielmenu.
- Weekplanning: vakken invullen, weekopmerkingen, afwezigheid tonen, legenda, wijzigingslog, alleen-lezen voor lezers.
- Scania-ritten: plannen (Ishøj/Rade, dag/nacht), rustcontrole (11 uur), afwezigheidswaarschuwing, vorige week kopiëren, export als tekst, rit zet vak in weekplanning.
- Stamgegevens: medewerkers en opdrachtgevers uit Easyflex2go (met werkmaatschappijen en KvK), kantoormedewerker toevoegen, status van de koppeling.

## Nog te bouwen

- Overzicht (bezetting per opdrachtgever, beschikbaarheid, afwezigheid) — design in het canvas.
- Exports: PDF weekplanning (liggend/staand), PDF Scania, PDF overzicht, Excel.
- Afwezigheid voor een periode invoeren, dagweergave, meerdere vakken tegelijk, vorige week kopiëren en vaste inzet in de weekplanning, wijzigingenpaneel.
- "Nu bijwerken"-knop voor de koppeling in Stamgegevens.
- Bij inloggen ook de naam uit Microsoft ophalen (scope `openid email profile` in `InlogKnop.tsx`).

## Open vragen aan Max

1. Welke Easyflex2go-relatie is Scania? (Nu zoekt de Scania-pagina op "scania" in de naam en vindt niets; "Manpower AB" is een kandidaat.)
2. Horen medewerkers van Solestus Payroll Solutions B.V. in de planning?
3. Medewerkers zonder nationaliteit: bij Chauffeurs NL laten of apart?
4. Interne relaties verbergen (Solestus-BV's, "Uitbetaling reserveringen", "Test Relatie")?
5. Controleren: "Sluyter Logistics Deventer B.V." en "Zwier Veldhoen" zijn samengevoegd op hetzelfde KvK-nummer.
6. Twee medewerkers met dezelfde naam maar verschillend registratienummer — zelfde persoon?
7. Definitie van de Scania-standaardweek.

## Design

Design-canvas: https://claude.ai/artifact/RitpwkgKvrgS61cGj6jXny — Solestus design system: https://claude.ai/code/artifact/dbdc72a2-af06-4dd9-823c-a7901d0329b4 — Bouwplan: https://claude.ai/code/artifact/8ebc9257-a293-4108-8310-7aa3c9293837
