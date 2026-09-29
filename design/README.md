# Design Solestus Planning

Dit is het design uit Claude (Design-canvas), als naslag voor de bouw.

- Live canvas: https://claude.ai/artifact/RitpwkgKvrgS61cGj6jXny
- Solestus design system: https://claude.ai/code/artifact/dbdc72a2-af06-4dd9-823c-a7901d0329b4

## Mappen

- `canvas/` — alle schermen als `.dc.html`. Elk bestand bevat de opmaak (HTML met inline stijlen) en onderaan een script met de schermlogica en voorbeelddata (`class Component extends DCLogic`). Lees ze als specificatie. Lettertypen en afbeeldingen verwijzen naar `/_blob/...` en laden buiten het canvas niet; kleuren, maten en teksten zijn wel volledig.
- `screenshots/` — een PNG per scherm op ware grootte (1440 breed; PDF's op A4-formaat), gerenderd uit de `.dc.html`-bestanden met de echte lettertypen en logo's. `_overzicht-alle-schermen.png` toont ze allemaal in één beeld.
- `canvas/canvas.json` — indeling van het canvas (rijen, titels, volgorde).
- `design-system/tokens.json` en `design-system/README.md` — kleuren, typografie en merkregels van Solestus.
- `design-system/logos/` — alle woordmerken (zwart en wit). De app gebruikt geminimaliseerde versies in `public/logo/`.

Kleine bestanden zoals `CelBewerken.dc.html` zijn varianten: ze laden `Main.dc.html` met andere instellingen (props), bijvoorbeeld een geopend paneel.

## Schermen

| Bestand | Scherm | Formaat | Screenshot |
|---|---|---|---|
| `FunctieOverzicht.dc.html` | Functie-overzicht | 1760×1180 | [screenshot](screenshots/FunctieOverzicht.png) |
| `Gebruikersflow.dc.html` | Gebruikersflow | 1760×900 | [screenshot](screenshots/Gebruikersflow.png) |
| `Inloggen.dc.html` | Inloggen | 1440×900 | [screenshot](screenshots/Inloggen.png) |
| `InloggenMislukt.dc.html` | Inloggen mislukt | 1440×900 | [screenshot](screenshots/InloggenMislukt.png) |
| `Uitgelogd.dc.html` | Uitgelogd | 1440×900 | [screenshot](screenshots/Uitgelogd.png) |
| `SessieVerlopen.dc.html` | Sessie verlopen | 1440×900 | [screenshot](screenshots/SessieVerlopen.png) |
| `Main.dc.html` | Weekplanning | 1440×900 | [screenshot](screenshots/Main.png) |
| `CelBewerken.dc.html` | Weekplanning · vak bewerken | 1440×900 | [screenshot](screenshots/CelBewerken.png) |
| `Dagweergave.dc.html` | Weekplanning · dagweergave | 1440×900 | [screenshot](screenshots/Dagweergave.png) |
| `Selectie.dc.html` | Weekplanning · meerdere vakken | 1440×900 | [screenshot](screenshots/Selectie.png) |
| `Opmerking.dc.html` | Opmerking bij de week | 1440×900 | [screenshot](screenshots/Opmerking.png) |
| `MedewerkerWeek.dc.html` | Medewerker en weekbericht | 1440×900 | [screenshot](screenshots/MedewerkerWeek.png) |
| `Afwezigheid.dc.html` | Afwezigheid voor een periode | 1440×900 | [screenshot](screenshots/Afwezigheid.png) |
| `Wijzigingen.dc.html` | Wijzigingen | 1440×900 | [screenshot](screenshots/Wijzigingen.png) |
| `WeekKopieren.dc.html` | Vorige week kopiëren | 1440×900 | [screenshot](screenshots/WeekKopieren.png) |
| `PdfExport.dc.html` | Exporteren (PDF en Excel) | 1440×900 | [screenshot](screenshots/PdfExport.png) |
| `Legenda.dc.html` | Legenda | 1440×900 | [screenshot](screenshots/Legenda.png) |
| `ProfielMenu.dc.html` | Profielmenu met uitloggen | 1440×900 | [screenshot](screenshots/ProfielMenu.png) |
| `StaatLaden.dc.html` | Laden | 1440×900 | [screenshot](screenshots/StaatLaden.png) |
| `StaatLeeg.dc.html` | Lege week | 1440×900 | [screenshot](screenshots/StaatLeeg.png) |
| `StaatAlleenLezen.dc.html` | Alleen lezen | 1440×900 | [screenshot](screenshots/StaatAlleenLezen.png) |
| `StaatOpslaanMislukt.dc.html` | Opslaan mislukt | 1440×900 | [screenshot](screenshots/StaatOpslaanMislukt.png) |
| `Scania.dc.html` | Scania-ritten | 1440×900 | [screenshot](screenshots/Scania.png) |
| `RitBewerken.dc.html` | Scania · rit bewerken | 1440×900 | [screenshot](screenshots/RitBewerken.png) |
| `Overzicht.dc.html` | Overzicht | 1440×960 | [screenshot](screenshots/Overzicht.png) |
| `Stamgegevens.dc.html` | Stamgegevens | 1440×1280 | [screenshot](screenshots/Stamgegevens.png) |
| `MedewerkerBewerken.dc.html` | Medewerker bewerken | 1440×1280 | [screenshot](screenshots/MedewerkerBewerken.png) |
| `OpdrachtgeverBewerken.dc.html` | Opdrachtgever bewerken | 1440×1280 | [screenshot](screenshots/OpdrachtgeverBewerken.png) |
| `KoppelingMislukt.dc.html` | Stamgegevens · koppeling Easyflex2go mislukt | 1440×1280 | [screenshot](screenshots/KoppelingMislukt.png) |
| `Navigatiebalk.dc.html` | Navigatiebalk (onderdeel) | 1440×72 | [screenshot](screenshots/Navigatiebalk.png) |
| `PdfLiggend.dc.html` | PDF · weekplanning A4 liggend | 1123×794 | [screenshot](screenshots/PdfLiggend.png) |
| `PdfStaand.dc.html` | PDF · weekplanning A4 staand | 794×1123 | [screenshot](screenshots/PdfStaand.png) |
| `PdfScania.dc.html` | PDF · Scania-ritten A4 liggend | 1123×794 | [screenshot](screenshots/PdfScania.png) |
| `PdfOverzicht.dc.html` | PDF · overzicht A4 liggend | 1123×794 | [screenshot](screenshots/PdfOverzicht.png) |
