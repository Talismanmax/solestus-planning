export type VakStatus =
  | "werk" | "kantoor" | "thuiswerk" | "opleiding" | "niet_ingezet"
  | "nbb" | "thuis" | "vakantie" | "vrij" | "ziek" | "einde";

type Soort = "in" | "vrij" | "weg" | "einde";

/** Telefoonnummer van de planning, voor berichten en afdrukken. */
export const TELEFOON = { nl: "0570-781010", int: "+31 570 781 010" };

/** Label, achtergrond, tekstkleur, soort — gelijk aan het design. Kleuren zijn CSS-variabelen
 *  (globals.css), zodat ze meeschakelen met dark mode; voor Excel zie STATUS_HEX. */
export const STATUS: Record<VakStatus, { label: string; bg: string; fg: string; soort: Soort }> = {
  werk: { label: "Ingezet", bg: "var(--st-werk-bg)", fg: "var(--st-werk-fg)", soort: "in" },
  kantoor: { label: "Kantoor", bg: "var(--st-kantoor-bg)", fg: "var(--st-kantoor-fg)", soort: "in" },
  thuiswerk: { label: "Thuiswerk", bg: "var(--st-thuiswerk-bg)", fg: "var(--st-thuiswerk-fg)", soort: "in" },
  opleiding: { label: "Opleiding", bg: "var(--st-opleiding-bg)", fg: "var(--st-opleiding-fg)", soort: "in" },
  niet_ingezet: { label: "Niet ingezet", bg: "var(--st-niet_ingezet-bg)", fg: "var(--st-niet_ingezet-fg)", soort: "vrij" },
  nbb: { label: "nbb", bg: "var(--st-nbb-bg)", fg: "var(--st-nbb-fg)", soort: "weg" },
  thuis: { label: "Thuis (rust)", bg: "var(--st-thuis-bg)", fg: "var(--st-thuis-fg)", soort: "weg" },
  vakantie: { label: "Vakantie", bg: "var(--st-vakantie-bg)", fg: "var(--st-vakantie-fg)", soort: "weg" },
  vrij: { label: "Vrij / verlof", bg: "var(--st-vrij-bg)", fg: "var(--st-vrij-fg)", soort: "weg" },
  ziek: { label: "Ziek", bg: "var(--st-ziek-bg)", fg: "var(--st-ziek-fg)", soort: "weg" },
  einde: { label: "Einde opdracht", bg: "var(--st-einde-bg)", fg: "var(--st-einde-fg)", soort: "einde" },
};

/** Dezelfde kleuren als hex (licht thema), voor bestanden buiten de browser zoals de Excel-export. */
export const STATUS_HEX: Record<VakStatus, { bg: string; fg: string }> = {
  werk: { bg: "#EBECE8", fg: "#231F20" },
  kantoor: { bg: "#E6E8F4", fg: "#363C72" },
  thuiswerk: { bg: "#E3EEF1", fg: "#1F5566" },
  opleiding: { bg: "#EEE4F5", fg: "#5A3979" },
  niet_ingezet: { bg: "#FBE9C2", fg: "#734D00" },
  nbb: { bg: "#EAEBE7", fg: "#57616A" },
  thuis: { bg: "#E4EDE0", fg: "#3B5A2C" },
  vakantie: { bg: "#DCEAFA", fg: "#1D4C84" },
  vrij: { bg: "#E9E5F6", fg: "#4A3F7E" },
  ziek: { bg: "#F8DCD5", fg: "#8A2916" },
  einde: { bg: "#D33A2C", fg: "#FFFFFF" },
};

export const STATUS_VOLGORDE: VakStatus[] = ["werk", "kantoor", "thuiswerk", "opleiding", "niet_ingezet", "thuis", "nbb", "vakantie", "vrij", "ziek", "einde"];

export const GROEPEN = [
  { id: "nl", label: "Chauffeurs NL" },
  { id: "int", label: "Chauffeurs internationaal" },
  { id: "kantoor", label: "Kantoor" },
] as const;
export type Groep = (typeof GROEPEN)[number]["id"];

export type Medewerker = {
  id: string; naam: string; groep: Groep; bv: string | null; nationaliteit: string | null;
  certificaten: string[]; bron: "easyflex" | "handmatig"; volgorde: number;
  vaste_inzet?: VasteInzet | null;
  telefoon?: string | null;
};

/** Vaste inzet van een medewerker (kolom medewerkers.vaste_inzet). Dagen: 0 = maandag … 6 = zondag. */
export type VasteInzet = { status: "werk" | "kantoor" | "thuiswerk"; opdrachtgever_id: string | null; dagen: number[] };

/** Dag- en maandnamen; dagen beginnen op maandag (index 0 = maandag). */
export const DAG_KORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
export const DAG_LANG = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
export const MAAND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MAAND_LANG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/** Dag van de week van een datum (yyyy-mm-dd), 0 = maandag. */
export const dagIndex = (datum: string) => (new Date(datum + "T00:00:00Z").getUTCDay() + 6) % 7;

/** "28 sep" */
export const dagMaand = (datum: string) => { const d = new Date(datum + "T00:00:00Z"); return `${d.getUTCDate()} ${MAAND[d.getUTCMonth()]}`; };

/** "ma–vr", "ma, wo" of "ma–do, za". */
function dagenLabel(dagen: number[]): string {
  const d = [...new Set(dagen)].filter((x) => x >= 0 && x <= 6).sort((a, b) => a - b);
  const delen: string[] = [];
  for (let i = 0; i < d.length; i++) {
    let j = i;
    while (j + 1 < d.length && d[j + 1] === d[j] + 1) j++;
    delen.push(j - i >= 2 ? `${DAG_KORT[d[i]]}–${DAG_KORT[d[j]]}` : d.slice(i, j + 1).map((x) => DAG_KORT[x]).join(", "));
    i = j;
  }
  return delen.join(", ");
}

/** Geldige vaste inzet, of null (leeg, geen dagen, of werk zonder opdrachtgever). */
export function geldigeVasteInzet(v: unknown): VasteInzet | null {
  if (!v || typeof v !== "object") return null;
  const x = v as Partial<VasteInzet>;
  if (!x.status || !["werk", "kantoor", "thuiswerk"].includes(x.status) || !Array.isArray(x.dagen) || !x.dagen.length) return null;
  if (x.status === "werk" && !x.opdrachtgever_id) return null;
  return { status: x.status, opdrachtgever_id: x.status === "werk" ? x.opdrachtgever_id ?? null : null, dagen: x.dagen.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) };
}

/** "Opdrachtgever B · ma–vr", "Kantoor · ma, wo" of "Geen". */
export function vasteInzetLabel(v: unknown, opdrachtgevers: Map<string, Pick<Opdrachtgever, "naam" | "korte_naam">>): string {
  const x = geldigeVasteInzet(v);
  if (!x) return "Geen";
  const wat = x.status === "werk" ? (opdrachtgevers.get(x.opdrachtgever_id!) ? opdrachtgeverLabel(opdrachtgevers.get(x.opdrachtgever_id!)!) : "Onbekende opdrachtgever") : STATUS[x.status].label;
  return `${wat} · ${dagenLabel(x.dagen)}`;
}
export type Opdrachtgever = { id: string; naam: string; korte_naam: string | null; plaats: string | null; verborgen?: boolean };

/** Naam zoals de planning die toont: de korte naam, anders de volledige naam. */
export function opdrachtgeverLabel(og: Pick<Opdrachtgever, "naam" | "korte_naam">) {
  return og.korte_naam || og.naam;
}
export type Vak = { id: string; medewerker_id: string; datum: string; status: VakStatus; opdrachtgever_id: string | null; notitie: string | null };
export type Afwezigheid = { id: string; medewerker_id: string; soort: VakStatus; van: string; tot_en_met: string; notitie?: string | null };

/** Soorten die als afwezigheid voor een periode kunnen worden ingevoerd (zie check in de database). */
/** Afwezigheidsperiode van een medewerker die een datum omvat, of undefined. */
export const afwezigheidOp = (afwezigheid: Afwezigheid[], mwId: string, datum: string) =>
  afwezigheid.find((a) => a.medewerker_id === mwId && a.van <= datum && a.tot_en_met >= datum);

export const AFWEZIG_SOORTEN: VakStatus[] = ["vakantie", "vrij", "ziek", "nbb", "einde"];

export type Cel = {
  label: string; sub: string; bg: string; fg: string;
  /** Afwezigheid uit een periode (cursief). */
  periode: boolean;
  /** Leeg op een werkdag: nog niet gepland. */
  open: boolean;
  /** Ingepland terwijl de medewerker afwezig is. */
  conflict: boolean;
  status: VakStatus | null;
};

/** Wat er in een vak van de weekplanning staat (scherm en PDF). */
export function celInhoud(
  mw: Pick<Medewerker, "id" | "groep">, datum: string, dagIndex: number, vak: Vak | undefined,
  afwezigheid: Afwezigheid[], opdrachtgevers: Map<string, Pick<Opdrachtgever, "naam" | "korte_naam">>,
): Cel {
  const a = afwezigheidOp(afwezigheid, mw.id, datum);
  if (vak) {
    const s = STATUS[vak.status];
    const og = vak.opdrachtgever_id ? opdrachtgevers.get(vak.opdrachtgever_id) : undefined;
    return {
      label: vak.status === "werk" ? (og ? opdrachtgeverLabel(og) : "Ingezet") : s.label, sub: vak.notitie ?? "",
      bg: s.bg, fg: s.fg, periode: false, open: false, conflict: !!a && s.soort === "in", status: vak.status,
    };
  }
  if (a) { const s = STATUS[a.soort]; return { label: s.label, sub: "", bg: s.bg, fg: s.fg, periode: true, open: false, conflict: false, status: a.soort }; }
  const open = dagIndex < 5 && mw.groep !== "kantoor";
  return { label: open ? "Open" : "", sub: "", bg: "transparent", fg: "#231f20", periode: false, open, conflict: false, status: null };
}

/** Per dag: aantal ingezet en aantal open vakken. */
export function dagTelling(cellen: Cel[]) {
  let inzet = 0, open = 0;
  for (const c of cellen) {
    if (c.open) open++;
    else if (c.status && STATUS[c.status].soort === "in") inzet++;
  }
  return { inzet, open };
}
export type WeekOpmerking = { id: string; medewerker_id: string; tekst: string };

// ---- Datums (als yyyy-mm-dd, zonder tijdzone-gedoe) ----
const DAG_MS = 86400000;
const toDate = (s: string) => new Date(s + "T00:00:00Z");
const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const plusDagen = (s: string, n: number) => toIso(new Date(toDate(s).getTime() + n * DAG_MS));

export function isoWeek(s: string): { jaar: number; week: number } {
  const d = toDate(s);
  const dag = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dag + 3);
  const jaar = d.getUTCFullYear();
  const eersteDonderdag = new Date(Date.UTC(jaar, 0, 4));
  const week = 1 + Math.round(((d.getTime() - eersteDonderdag.getTime()) / DAG_MS - 3 + ((eersteDonderdag.getUTCDay() + 6) % 7)) / 7);
  return { jaar, week };
}

export function maandagVan(jaar: number, week: number): string {
  const jan4 = new Date(Date.UTC(jaar, 0, 4));
  const ma = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAG_MS + (week - 1) * 7 * DAG_MS);
  return toIso(ma);
}

export function vandaagNL(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

/** "2026-W40" → maandag; ongeldig → huidige week. */
export function weekUitParam(p?: string): { jaar: number; week: number; maandag: string } {
  const m = p?.match(/^(\d{4})-W(\d{1,2})$/);
  if (m) {
    const jaar = +m[1], week = +m[2];
    if (week >= 1 && week <= 53) return { jaar, week, maandag: maandagVan(jaar, week) };
  }
  const nu = isoWeek(vandaagNL());
  return { ...nu, maandag: maandagVan(nu.jaar, nu.week) };
}

export const weekParam = (maandag: string) => { const w = isoWeek(maandag); return `${w.jaar}-W${w.week}`; };

// ---- Verloningsperiodes van 4 weken: periode 1 = week 1–4, …, periode 13 = week 49 t/m de laatste week ----
/** Aantal ISO-weken in een jaar (52 of 53): 28 december valt altijd in de laatste week. */
const wekenInJaar = (jaar: number) => isoWeek(`${jaar}-12-28`).week;

export type Periode = { jaar: number; periode: number; weken: number[] };

function periodeVan(jaar: number, week: number): Periode {
  const periode = Math.min(13, Math.ceil(week / 4));
  const eerste = (periode - 1) * 4 + 1;
  const laatste = periode === 13 ? wekenInJaar(jaar) : eerste + 3;
  return { jaar, periode, weken: Array.from({ length: laatste - eerste + 1 }, (_, i) => eerste + i) };
}

/** "2026-P10" → periode; ongeldig of leeg → de periode van vandaag. */
export function periodeUitParam(p?: string): Periode {
  const m = p?.match(/^(\d{4})-P(\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 13) return periodeVan(+m[1], (+m[2] - 1) * 4 + 1);
  const nu = isoWeek(vandaagNL());
  return periodeVan(nu.jaar, nu.week);
}

export const periodeParam = (p: Pick<Periode, "jaar" | "periode">) => `${p.jaar}-P${p.periode}`;

/** Vorige of volgende periode, over de jaargrens heen. */
export function periodeErnaast(p: Pick<Periode, "jaar" | "periode">, stap: 1 | -1): Periode {
  if (stap === 1) return p.periode === 13 ? periodeVan(p.jaar + 1, 1) : periodeVan(p.jaar, p.periode * 4 + 1);
  return p.periode === 1 ? periodeVan(p.jaar - 1, 49) : periodeVan(p.jaar, (p.periode - 2) * 4 + 1);
}


export function dagInfo(s: string, i: number) {
  const d = toDate(s);
  return {
    kort: DAG_KORT[i],
    nummer: d.getUTCDate(),
    maand: MAAND[d.getUTCMonth()],
    lang: `${DAG_LANG[i]} ${d.getUTCDate()} ${MAAND_LANG[d.getUTCMonth()]}`,
  };
}

export function weekBereik(maandag: string) {
  const a = toDate(maandag), b = toDate(plusDagen(maandag, 6));
  const zelfdeMaand = a.getUTCMonth() === b.getUTCMonth();
  return zelfdeMaand
    ? `${a.getUTCDate()} – ${b.getUTCDate()} ${MAAND[b.getUTCMonth()]} ${b.getUTCFullYear()}`
    : `${a.getUTCDate()} ${MAAND[a.getUTCMonth()]} – ${b.getUTCDate()} ${MAAND[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

/** Aantal kalenderdagen van van t/m tot_en_met. */
export const aantalDagen = (van: string, tot: string) => Math.round((toDate(tot).getTime() - toDate(van).getTime()) / DAG_MS) + 1;

/** "28 sep – 5 okt", "28 – 29 sep" of "28 sep". Over een jaargrens: "28 dec 2026 – 3 jan 2027". */
export function periodeKort(van: string, tot: string) {
  const a = toDate(van), b = toDate(tot);
  const dm = (d: Date) => `${d.getUTCDate()} ${MAAND[d.getUTCMonth()]}`;
  if (van === tot) return dm(a);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${dm(a)} ${a.getUTCFullYear()} – ${dm(b)} ${b.getUTCFullYear()}`;
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()} – ${dm(b)}` : `${dm(a)} – ${dm(b)}`;
}
