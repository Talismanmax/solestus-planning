# Design Solestus Planning

Dit is het design uit Claude (Design-canvas), als naslag voor de bouw.

- Live canvas: https://claude.ai/artifact/RitpwkgKvrgS61cGj6jXny
- Solestus design system: https://claude.ai/code/artifact/dbdc72a2-af06-4dd9-823c-a7901d0329b4

## Mappen

- `canvas/` — alle schermen als `.dc.html`. Elk bestand bevat de opmaak (HTML met inline stijlen) en onderaan een script met de schermlogica en voorbeelddata (`class Component extends DCLogic`). Lees ze als specificatie. Lettertypen en afbeeldingen verwijzen naar `/_blob/...` en laden buiten het canvas niet; kleuren, maten en teksten zijn wel volledig.
- `canvas/canvas.json` — indeling van het canvas (rijen, titels, volgorde).
- `design-system/tokens.json` en `design-system/README.md` — kleuren, typografie en merkregels van Solestus.
- `design-system/logos/` — alle woordmerken (zwart en wit). De app gebruikt geminimaliseerde versies in `public/logo/`.

Kleine bestanden zoals `CelBewerken.dc.html` zijn varianten: ze laden `Main.dc.html` met andere instellingen (props), bijvoorbeeld een geopend paneel.

## Schermen

| Bestand | Scherm | Formaat |
|---|---|---|
| `FunctieOverzicht.dc.html` | Functie-overzicht | 1760×1180 |
| `Gebruikersflow.dc.html` | Gebruikersflow | 1760×900 |
| `Inloggen.dc.html` | Inloggen | 1440×900 |
| `InloggenMislukt.dc.html` | Inloggen mislukt | 1440×900 |
| `Uitgelogd.dc.html` | Uitgelogd | 1440×900 |
| `SessieVerlopen.dc.html` | Sessie verlopen | 1440×900 |
| `Main.dc.html` | Weekplanning | 1440×900 |
| `CelBewerken.dc.html` | Weekplanning · vak bewerken | 1440×900 |
| `Dagweergave.dc.html` | Weekplanning · dagweergave | 1440×900 |
| `Selectie.dc.html` | Weekplanning · meerdere vakken | 1440×900 |
| `Opmerking.dc.html` | Opmerking bij de week | 1440×900 |
| `MedewerkerWeek.dc.html` | Medewerker en weekbericht | 1440×900 |
| `Afwezigheid.dc.html` | Afwezigheid voor een periode | 1440×900 |
| `Wijzigingen.dc.html` | Wijzigingen | 1440×900 |
| `WeekKopieren.dc.html` | Vorige week kopiëren | 1440×900 |
| `PdfExport.dc.html` | Exporteren (PDF en Excel) | 1440×900 |
| `Legenda.dc.html` | Legenda | 1440×900 |
| `ProfielMenu.dc.html` | Profielmenu met uitloggen | 1440×900 |
| `StaatLaden.dc.html` | Laden | 1440×900 |
| `StaatLeeg.dc.html` | Lege week | 1440×900 |
| `StaatAlleenLezen.dc.html` | Alleen lezen | 1440×900 |
| `StaatOpslaanMislukt.dc.html` | Opslaan mislukt | 1440×900 |
| `Scania.dc.html` | Scania-ritten | 1440×900 |
| `RitBewerken.dc.html` | Scania · rit bewerken | 1440×900 |
| `Overzicht.dc.html` | Overzicht | 1440×960 |
| `Stamgegevens.dc.html` | Stamgegevens | 1440×1280 |
| `MedewerkerBewerken.dc.html` | Medewerker bewerken | 1440×1280 |
| `OpdrachtgeverBewerken.dc.html` | Opdrachtgever bewerken | 1440×1280 |
| `KoppelingMislukt.dc.html` | Stamgegevens · koppeling Easyflex2go mislukt | 1440×1280 |
| `Navigatiebalk.dc.html` | Navigatiebalk (onderdeel) | 1440×72 |
| `PdfLiggend.dc.html` | PDF · weekplanning A4 liggend | 1123×794 |
| `PdfStaand.dc.html` | PDF · weekplanning A4 staand | 794×1123 |
| `PdfScania.dc.html` | PDF · Scania-ritten A4 liggend | 1123×794 |
| `PdfOverzicht.dc.html` | PDF · overzicht A4 liggend | 1123×794 |
