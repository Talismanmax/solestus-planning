import { dagTijd, naarIso, tijd } from "./tijd";

export type Dienst = "dag" | "nacht";
export type Route = "ishoj" | "rade";
export type RitDeel = { id?: string; volgorde: number; van: string; naar: string; vertrek: string; aankomst: string };
export type Rit = { id: string; vertrekdatum: string; dienst: Dienst; route: Route; chauffeur_id: string | null; notitie: string | null; rit_delen: RitDeel[] };
export type Chauffeur = { id: string; naam: string; groep: "nl" | "int" | "kantoor"; nationaliteit: string | null };

export const ROUTE_NAAM: Record<Route, string> = { ishoj: "Zwolle – Ishøj – Zwolle", rade: "Zwolle – Rade – Zwolle (swap)" };
export const ROUTE_KORT: Record<Route, string> = { ishoj: "Ishøj", rade: "Rade · swap" };
export const RUST_UREN = 11;

function plusDag(datum: string, n: number) {
  const d = new Date(datum + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Standaardtijden voor een nieuwe rit (Nederlandse tijd). */
export function standaardDelen(datum: string, dienst: Dienst, route: Route): RitDeel[] {
  const t = (dag: number, u: string) => naarIso(`${plusDag(datum, dag)}T${u}`);
  const [start, eind, eindDag] = dienst === "dag" ? ["09:00", "20:00", 0] : ["21:00", "08:00", 1];
  if (route === "rade") {
    return [{ volgorde: 1, van: "Zwolle", naar: "Rade (swap) – Zwolle", vertrek: t(0, start), aankomst: t(eindDag, eind) }];
  }
  return [
    { volgorde: 1, van: "Zwolle", naar: "Ishøj", vertrek: t(0, start), aankomst: t(eindDag, eind) },
    { volgorde: 2, van: "Ishøj", naar: "Zwolle", vertrek: t(1, start), aankomst: t(1 + eindDag, eind) },
  ];
}

export const begin = (r: Rit) => r.rit_delen.reduce((a, d) => (d.vertrek < a ? d.vertrek : a), r.rit_delen[0]?.vertrek ?? r.vertrekdatum + "T00:00:00Z");
export const einde = (r: Rit) => r.rit_delen.reduce((a, d) => (d.aankomst > a ? d.aankomst : a), r.rit_delen[0]?.aankomst ?? r.vertrekdatum + "T23:59:00Z");

/** Uren rust tussen deze rit en de vorige rit van dezelfde chauffeur (null als er geen vorige is). */
export function rustVoor(rit: Rit, alle: Rit[]): { uren: number; vorige: Rit } | null {
  if (!rit.chauffeur_id) return null;
  const start = begin(rit);
  const eerder = alle.filter((r) => r.id !== rit.id && r.chauffeur_id === rit.chauffeur_id && einde(r) <= start);
  if (!eerder.length) return null;
  const vorige = eerder.reduce((a, r) => (einde(r) > einde(a) ? r : a));
  return { uren: (new Date(start).getTime() - new Date(einde(vorige)).getTime()) / 3600000, vorige };
}

/** Regels voor het bericht aan de chauffeur, zoals in het design. */
export function ritTekst(r: Rit): string {
  const d = [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde);
  const kop = `- ${dagTijd(d[0].vertrek)} (${r.dienst})`;
  if (r.route === "rade") return `${kop}: Zwolle – Rade (swap) – Zwolle, terug ${dagTijd(d[0].aankomst)}`;
  const heen = d[0], terug = d[1];
  const t1 = `Zwolle > Ishøj ${dagTijd(heen.aankomst)}`;
  const t2 = terug ? ` | Ishøj ${dagTijd(terug.vertrek)} > Zwolle ${dagTijd(terug.aankomst)}` : "";
  return `${kop}: ${t1}${t2}`;
}

export function deelRegel(d: RitDeel) {
  return { titel: `${d.van} → ${d.naar}`, tijden: `${dagTijd(d.vertrek)} – ${dagTijd(d.aankomst)}`, kort: `${tijd(d.vertrek)}–${tijd(d.aankomst)}` };
}
