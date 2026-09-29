export type VakStatus =
  | "werk" | "kantoor" | "thuiswerk" | "opleiding" | "niet_ingezet"
  | "nbb" | "thuis" | "vakantie" | "vrij" | "ziek" | "einde";

export type Soort = "in" | "vrij" | "weg" | "einde";

/** Label, achtergrond, tekstkleur, soort — gelijk aan het design. */
/** Kleuren zijn CSS-variabelen (globals.css), zodat ze meeschakelen met dark mode. */
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

const DAG_AFK = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** "ma–vr", "ma, wo" of "ma–do, za". */
export function dagenLabel(dagen: number[]): string {
  const d = [...new Set(dagen)].filter((x) => x >= 0 && x <= 6).sort((a, b) => a - b);
  const delen: string[] = [];
  for (let i = 0; i < d.length; i++) {
    let j = i;
    while (j + 1 < d.length && d[j + 1] === d[j] + 1) j++;
    delen.push(j - i >= 2 ? `${DAG_AFK[d[i]]}–${DAG_AFK[d[j]]}` : d.slice(i, j + 1).map((x) => DAG_AFK[x]).join(", "));
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

/** De Easyflex2go-relatie waaronder de Scania-ritten vallen. */
export const SCANIA_RELATIE = "Manpower AB";

/** Naam zoals de planning die toont: de korte naam, anders de volledige naam. */
export function opdrachtgeverLabel(og: Pick<Opdrachtgever, "naam" | "korte_naam">) {
  return og.korte_naam || og.naam;
}
export type Vak = { id: string; medewerker_id: string; datum: string; status: VakStatus; opdrachtgever_id: string | null; notitie: string | null };
export type Afwezigheid = { id: string; medewerker_id: string; soort: VakStatus; van: string; tot_en_met: string; notitie?: string | null };

/** Soorten die als afwezigheid voor een periode kunnen worden ingevoerd (zie check in de database). */
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
  const a = afwezigheid.find((x) => x.medewerker_id === mw.id && x.van <= datum && x.tot_en_met >= datum);
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
