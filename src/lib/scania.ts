import { STATUS, type Afwezigheid, type Vak } from "./planning";
import { dagTijd, naarIso, tijd } from "./tijd";
import { afwezigheidOp, DAG_KORT, dagIndex, dagMaand, plusDagen } from "@/lib/planning";
import { rijtijdMeldingen } from "./rijtijden";

export type Dienst = "dag" | "nacht";
export type Route = "ishoj" | "rade" | "extra";
export type RitDeel = { id?: string; volgorde: number; van: string; naar: string; vertrek: string; aankomst: string; rijtijd_min?: number | null };
export type Rit = { id: string; vertrekdatum: string; dienst: Dienst; route: Route; chauffeur_id: string | null; notitie: string | null; omschrijving?: string | null; rit_delen: RitDeel[] };
export type Chauffeur = { id: string; naam: string; groep: "nl" | "int" | "kantoor"; nationaliteit: string | null };

/** Namen van de routes: voluit (kop, knoppen), heen (afdruk), kort (tabel) en de plaats (meldingen, weekplanning). */
export const ROUTE: Record<Route, { naam: string; heen: string; kort: string; plaats: string }> = {
  ishoj: { naam: "Zwolle – Ishøj – Zwolle", heen: "Zwolle – Ishøj", kort: "Ishøj", plaats: "Ishøj" },
  rade: { naam: "Zwolle – Rade – Zwolle (swap)", heen: "Zwolle – Rade (swap)", kort: "Rade · swap", plaats: "Rade" },
  extra: { naam: "Extra opdracht", heen: "Extra opdracht", kort: "Extra", plaats: "de extra opdracht" },
};
export const RUST_UREN = 11;

/** Standaardtijden voor een nieuwe rit (Nederlandse tijd). */
export function standaardDelen(datum: string, dienst: Dienst, route: Route): RitDeel[] {
  const t = (dag: number, u: string) => naarIso(`${plusDagen(datum, dag)}T${u}`);
  const [start, eind, eindDag] = dienst === "dag" ? ["09:00", "20:00", 0] as const : ["21:00", "08:00", 1] as const;
  if (route === "rade") {
    return [{ volgorde: 1, van: "Zwolle", naar: "Rade (swap) – Zwolle", vertrek: t(0, start), aankomst: t(eindDag, eind) }];
  }
  // Extra opdracht: één deel met dezelfde tijden; van, naar en tijden past de planner aan.
  if (route === "extra") return [{ volgorde: 1, van: "Zwolle", naar: "Zwolle", vertrek: t(0, start), aankomst: t(eindDag, eind) }];
  // Terug uit Ishøj: dag vertrekt de volgende dag 09.00, nacht de volgende dag 20.00.
  const terug = dienst === "dag" ? "09:00" : "20:00";
  return [
    { volgorde: 1, van: "Zwolle", naar: "Ishøj", vertrek: t(0, start), aankomst: t(eindDag, eind) },
    { volgorde: 2, van: "Ishøj", naar: "Zwolle", vertrek: t(1, terug), aankomst: t(1 + eindDag, eind) },
  ];
}

/** De vaste ritten van een gewone week: dag (0 = maandag), dienst en route. Tijden volgen uit standaardDelen. */
export const STANDAARDWEEK: { dag: number; dienst: Dienst; route: Route }[] = [
  { dag: 0, dienst: "dag", route: "ishoj" },
  { dag: 1, dienst: "nacht", route: "ishoj" },
  { dag: 2, dienst: "dag", route: "ishoj" },
  { dag: 3, dienst: "nacht", route: "ishoj" },
  { dag: 4, dienst: "dag", route: "ishoj" },
  { dag: 5, dienst: "nacht", route: "rade" },
  { dag: 6, dienst: "dag", route: "rade" },
  { dag: 6, dienst: "nacht", route: "ishoj" },
];

const begin = (r: Rit) => r.rit_delen.reduce((a, d) => (d.vertrek < a ? d.vertrek : a), r.rit_delen[0]?.vertrek ?? r.vertrekdatum + "T00:00:00Z");
const einde = (r: Rit) => r.rit_delen.reduce((a, d) => (d.aankomst > a ? d.aankomst : a), r.rit_delen[0]?.aankomst ?? r.vertrekdatum + "T23:59:00Z");

/** Uren rust tussen deze rit en de vorige rit van dezelfde chauffeur (null als er geen vorige is). */
export function rustVoor(rit: Rit, alle: Rit[]): { uren: number; vorige: Rit } | null {
  if (!rit.chauffeur_id) return null;
  const start = begin(rit);
  const eerder = alle.filter((r) => r.id !== rit.id && r.chauffeur_id === rit.chauffeur_id && einde(r) <= start);
  if (!eerder.length) return null;
  const vorige = eerder.reduce((a, r) => (einde(r) > einde(a) ? r : a));
  return { uren: (new Date(start).getTime() - new Date(einde(vorige)).getTime()) / 3600000, vorige };
}

/** Afwezigheid van een chauffeur op een dag (periode of vak), als kleine letters, of null. */
export function afwezigOp(mwId: string, datum: string, afwezigheid: Afwezigheid[], vakken: Vak[]): string | null {
  const a = afwezigheidOp(afwezigheid, mwId, datum);
  if (a) return STATUS[a.soort].label.toLowerCase();
  const v = vakken.find((x) => x.medewerker_id === mwId && x.datum === datum);
  if (v && STATUS[v.status].soort === "weg") return STATUS[v.status].label.toLowerCase();
  return null;
}

type RitMelding = { kort: string; lang: string };


/** Waarschuwingen bij een rit: te weinig rust, rijtijd boven de grens, of de chauffeur is afwezig. Kort voor in de tabel, lang voor "Let op". */
export function ritMeldingen(r: Rit, alleRitten: Rit[], afwezigheid: Afwezigheid[], vakken: Vak[]): RitMelding[] {
  const w: RitMelding[] = [];
  if (!r.chauffeur_id) return w;
  const rust = rustVoor(r, alleRitten);
  if (rust && rust.uren < RUST_UREN) {
    const u = Math.max(0, Math.round(rust.uren));
    w.push({ kort: `Maar ${u} uur rust na vorige rit`, lang: `Maar ${u} uur rust tussen terugkomst uit ${ROUTE[rust.vorige.route].plaats} en vertrek naar ${ROUTE[r.route].plaats}.` });
  }
  w.push(...rijtijdMeldingen(r, alleRitten));
  const dag = DAG_KORT[dagIndex(r.vertrekdatum)];
  const a = afwezigheidOp(afwezigheid, r.chauffeur_id, r.vertrekdatum);
  if (a) {
    const soort = STATUS[a.soort].label;
    w.push({ kort: `${soort} op ${dag}`, lang: `Ingepland tijdens ${soort.toLowerCase()} (${dagMaand(a.van)} t/m ${dagMaand(a.tot_en_met)}).` });
  } else {
    const v = vakken.find((x) => x.medewerker_id === r.chauffeur_id && x.datum === r.vertrekdatum);
    if (v && STATUS[v.status].soort === "weg") w.push({ kort: `${STATUS[v.status].label} op ${dag}`, lang: `In de weekplanning staat ${STATUS[v.status].label.toLowerCase()} op deze dag.` });
  }
  return w;
}

/** Regel voor het bericht aan de chauffeur, zoals in het design (Nederlands of Engels). */
export function ritTekst(r: Rit, taal: "nl" | "en" = "nl"): string {
  const d = [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde);
  const t = (iso: string) => dagTijd(iso, taal);
  const dienst = taal === "en" ? (r.dienst === "dag" ? "day" : "night") : r.dienst;
  const kop = `- ${t(d[0].vertrek)} (${dienst})`;
  if (r.route === "rade") return `${kop}: Zwolle – Rade (swap) – Zwolle, ${taal === "en" ? "back" : "terug"} ${t(d[0].aankomst)}`;
  if (r.route === "extra") {
    const wat = r.omschrijving?.trim() || (taal === "en" ? "extra job" : "extra opdracht");
    return `${kop} ${"EXTRA"} ${wat}: ${d.map((x) => `${x.van} ${t(x.vertrek)} > ${x.naar} ${t(x.aankomst)}`).join(" | ")}`;
  }
  const heen = d[0], terug = d[1];
  const t1 = `Zwolle > Ishøj ${t(heen.aankomst)}`;
  const t2 = terug ? ` | Ishøj ${t(terug.vertrek)} > Zwolle ${t(terug.aankomst)}` : "";
  return `${kop}: ${t1}${t2}`;
}

export function deelRegel(d: RitDeel) {
  return { titel: `${d.van} → ${d.naar}`, tijden: `${dagTijd(d.vertrek)} – ${dagTijd(d.aankomst)}`, kort: `${tijd(d.vertrek)}–${tijd(d.aankomst)}` };
}
