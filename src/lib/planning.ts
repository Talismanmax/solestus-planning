export type VakStatus =
  | "werk" | "kantoor" | "thuiswerk" | "opleiding" | "niet_ingezet"
  | "nbb" | "thuis" | "vakantie" | "vrij" | "ziek" | "einde";

export type Soort = "in" | "vrij" | "weg" | "einde";

/** Label, achtergrond, tekstkleur, soort — gelijk aan het design. */
export const STATUS: Record<VakStatus, { label: string; bg: string; fg: string; soort: Soort }> = {
  werk: { label: "Ingezet", bg: "#ebece8", fg: "#231f20", soort: "in" },
  kantoor: { label: "Kantoor", bg: "#E6E8F4", fg: "#363C72", soort: "in" },
  thuiswerk: { label: "Thuiswerk", bg: "#E3EEF1", fg: "#1F5566", soort: "in" },
  opleiding: { label: "Opleiding", bg: "#EEE4F5", fg: "#5A3979", soort: "in" },
  niet_ingezet: { label: "Niet ingezet", bg: "#FBE9C2", fg: "#734D00", soort: "vrij" },
  nbb: { label: "nbb", bg: "#EAEBE7", fg: "#57616A", soort: "weg" },
  thuis: { label: "Thuis (rust)", bg: "#E4EDE0", fg: "#3B5A2C", soort: "weg" },
  vakantie: { label: "Vakantie", bg: "#DCEAFA", fg: "#1D4C84", soort: "weg" },
  vrij: { label: "Vrij / verlof", bg: "#E9E5F6", fg: "#4A3F7E", soort: "weg" },
  ziek: { label: "Ziek", bg: "#F8DCD5", fg: "#8A2916", soort: "weg" },
  einde: { label: "Einde opdracht", bg: "#D33A2C", fg: "#FFFFFF", soort: "einde" },
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
};
export type Opdrachtgever = { id: string; naam: string; korte_naam: string | null; plaats: string | null };
export type Vak = { id: string; medewerker_id: string; datum: string; status: VakStatus; opdrachtgever_id: string | null; notitie: string | null };
export type Afwezigheid = { id: string; medewerker_id: string; soort: VakStatus; van: string; tot_en_met: string; notitie?: string | null };

/** Soorten die als afwezigheid voor een periode kunnen worden ingevoerd (zie check in de database). */
export const AFWEZIG_SOORTEN: VakStatus[] = ["vakantie", "vrij", "ziek", "nbb", "einde"];
export type WeekOpmerking = { id: string; medewerker_id: string; tekst: string };

// ---- Datums (als yyyy-mm-dd, zonder tijdzone-gedoe) ----
const DAG_MS = 86400000;
const toDate = (s: string) => new Date(s + "T00:00:00Z");
export const toIso = (d: Date) => d.toISOString().slice(0, 10);
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

const DAG_KORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const DAG_LANG = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const MAAND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MAAND_LANG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

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

export function tijdstipNL(ts: string) {
  return new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}
