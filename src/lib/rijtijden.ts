import type { Rit, RitDeel, Route } from "./scania";
import { dagIndex, plusDagen } from "./planning";
import { naarIso } from "./tijd";

/**
 * Rijtijden volgens de EU-regels (verordening 561/2006), op basis van de geplande Scania-ritten.
 * Alleen de Scania-ritten tellen mee; ander rijwerk staat niet in de planning.
 */
export const LIMIET = {
  dag: 9 * 60,          // per rijdag, 2× per week mag 10 uur
  dagVerlengd: 10 * 60,
  verlengdPerWeek: 2,
  week: 56 * 60,        // per week (ma 00.00 – zo 24.00)
  tweeWeken: 90 * 60,   // per twee opeenvolgende weken
};
/** Minder rust dan dit tussen twee delen: ze horen bij dezelfde rijdag. */
const DAGRUST_MIN = 9 * 60;
/** Wekelijkse rust: minstens 24 uur, uiterlijk na 6 dagen (6 × 24 uur). */
const WEEKRUST_MIN = 24 * 60;
const ZES_DAGEN_MIN = 6 * 24 * 60;

/** Standaard rijtijd van een deel (minuten) als de planner niets heeft ingevuld. Pauzes en de veerboot tellen niet mee. */
export function standaardRijtijd(route: Route, d: Pick<RitDeel, "vertrek" | "aankomst">): number {
  if (route === "ishoj") return 9 * 60;
  if (route === "rade") return 8 * 60;
  // Extra opdracht: de hele duur, min 45 minuten pauze als het langer dan 4,5 uur is.
  const duur = Math.max(0, (Date.parse(d.aankomst) - Date.parse(d.vertrek)) / 60000);
  return Math.round(duur > 270 ? duur - 45 : duur);
}

export const rijtijdVan = (route: Route, d: RitDeel) => d.rijtijd_min ?? standaardRijtijd(route, d);

/** 540 → "9 u", 495 → "8u15". */
export function uren(min: number) {
  const m = Math.round(min);
  const u = Math.floor(m / 60), r = m % 60;
  return r ? `${u}u${String(r).padStart(2, "0")}` : `${u} u`;
}

/** "8:15", "8u15", "8" of "8,25" → minuten; leeg of ongeldig → null. */
export function leesUren(t: string): number | null {
  const s = t.trim().toLowerCase();
  if (!s) return null;
  const klok = s.match(/^(\d{1,2})[:u](\d{2})$/);
  const min = klok ? Number(klok[1]) * 60 + Number(klok[2])
    : /^\d{1,2}([.,]\d+)?$/.test(s) ? Math.round(Number(s.replace(",", ".")) * 60) : NaN;
  return Number.isFinite(min) && min <= 1440 && (!klok || Number(klok[2]) < 60) ? min : null;
}

type Blok = { ritId: string; start: number; eind: number; min: number };

/** Alle rijdelen van een chauffeur, op volgorde. */
function blokken(ritten: Rit[], chauffeurId: string): Blok[] {
  return ritten.filter((r) => r.chauffeur_id === chauffeurId)
    .flatMap((r) => r.rit_delen.map((d) => ({ ritId: r.id, start: Date.parse(d.vertrek), eind: Date.parse(d.aankomst), min: rijtijdVan(r.route, d) })))
    .filter((b) => b.eind > b.start)
    .sort((a, b) => a.start - b.start);
}

const weekBegin = (maandag: string) => Date.parse(naarIso(`${maandag}T00:00`));
const maandagVanDatum = (datum: string) => plusDagen(datum, -dagIndex(datum));

/** Het deel van de rijtijd dat in [van, tot) valt, naar rato van de tijd die het deel daarin ligt. */
const deelIn = (b: Blok, van: number, tot: number) => b.min * Math.max(0, Math.min(b.eind, tot) - Math.max(b.start, van)) / (b.eind - b.start);
const somIn = (bs: Blok[], van: number, tot: number) => bs.reduce((a, b) => a + deelIn(b, van, tot), 0);

/** Rijdagen: delen met minder dan 9 uur rust ertussen tellen als één dag. */
function rijdagen(bs: Blok[]) {
  const dagen: { start: number; eind: number; min: number; ritten: Set<string> }[] = [];
  for (const b of bs) {
    const laatste = dagen[dagen.length - 1];
    if (laatste && b.start - laatste.eind < DAGRUST_MIN * 60000) {
      laatste.eind = Math.max(laatste.eind, b.eind); laatste.min += b.min; laatste.ritten.add(b.ritId);
    } else dagen.push({ start: b.start, eind: b.eind, min: b.min, ritten: new Set([b.ritId]) });
  }
  return dagen;
}

export type RijtijdStand = {
  vorige: number; deze: number; volgende: number;
  /** Hoogste van vorige + deze en deze + volgende week. */
  tweeWeken: number;
  /** Wat er deze week nog bij kan binnen 56 en 90 uur. */
  nog: number;
  /** Dagen met meer dan 9 uur rijden in deze week. */
  verlengd: number;
};

/** Rijtijden van een chauffeur rond de week van `maandag` (minuten). */
export function rijtijdStand(ritten: Rit[], chauffeurId: string, maandag: string): RijtijdStand {
  const bs = blokken(ritten, chauffeurId);
  const w = (m: string) => somIn(bs, weekBegin(m), weekBegin(plusDagen(m, 7)));
  const vorige = w(plusDagen(maandag, -7)), deze = w(maandag), volgende = w(plusDagen(maandag, 7));
  const van = weekBegin(maandag), tot = weekBegin(plusDagen(maandag, 7));
  const verlengd = rijdagen(bs).filter((d) => d.start >= van && d.start < tot && d.min > LIMIET.dag).length;
  return {
    vorige, deze, volgende,
    tweeWeken: Math.max(vorige + deze, deze + volgende),
    nog: Math.max(0, Math.min(LIMIET.week - deze, LIMIET.tweeWeken - vorige - deze, LIMIET.tweeWeken - deze - volgende)),
    verlengd,
  };
}

type Melding = { kort: string; lang: string };

/**
 * Overschrijdingen door deze rit. `alle` mag een oudere versie van dezelfde rit bevatten; die wordt vervangen.
 * Week- en twee-wekenlimieten komen bij de rit waarmee de grens wordt overschreden en de ritten daarna.
 */
export function rijtijdMeldingen(rit: Rit, alle: Rit[]): Melding[] {
  if (!rit.chauffeur_id) return [];
  const ritten = [...alle.filter((r) => r.id !== rit.id), rit];
  const bs = blokken(ritten, rit.chauffeur_id);
  const eigen = bs.filter((b) => b.ritId === rit.id);
  if (!eigen.length) return [];
  const uit: Melding[] = [];
  const maandag = maandagVanDatum(rit.vertrekdatum);
  const van = weekBegin(maandag), tot = weekBegin(plusDagen(maandag, 7));

  // Per rijdag: max 9 uur, twee keer per week 10 uur.
  const dagen = rijdagen(bs);
  const verlengdInWeek = dagen.filter((d) => d.start >= van && d.start < tot && d.min > LIMIET.dag);
  // Een rijdag met meerdere ritten betekent te weinig rust ertussen; dat meldt de rustcontrole al.
  for (const d of dagen.filter((x) => x.ritten.has(rit.id) && x.ritten.size === 1)) {
    if (d.min > LIMIET.dagVerlengd) uit.push({ kort: `${uren(d.min)} rijden op één dag`, lang: `${uren(d.min)} rijtijd op één dag; maximaal 10 uur (en dat maar twee keer per week).` });
    else if (d.min > LIMIET.dag && verlengdInWeek.indexOf(d) >= LIMIET.verlengdPerWeek) {
      const n = verlengdInWeek.indexOf(d) + 1;
      uit.push({ kort: `${n}e dag boven 9 u`, lang: `De ${n}e dag deze week met meer dan 9 uur rijden; dat mag maar twee keer per week.` });
    }
  }

  // Tot en met deze rit opgeteld, binnen een periode.
  const totEnMet = (vanaf: number, totaan: number) => somIn(bs.filter((b) => b.start <= eigen[eigen.length - 1].start), vanaf, totaan);
  const eigenIn = (vanaf: number, totaan: number) => eigen.some((b) => deelIn(b, vanaf, totaan) > 0);
  const week = totEnMet(van, tot);
  if (eigenIn(van, tot) && week > LIMIET.week) uit.push({ kort: `${uren(week)} rijden deze week`, lang: `Met deze rit ${uren(week)} rijtijd in de week; maximaal 56 uur.` });
  for (const [a, b] of [[plusDagen(maandag, -7), maandag], [maandag, plusDagen(maandag, 7)]] as const) {
    const s = weekBegin(a), e = weekBegin(plusDagen(b, 7));
    const twee = totEnMet(s, e);
    if (eigenIn(s, e) && twee > LIMIET.tweeWeken) { uit.push({ kort: `${uren(twee)} in 2 weken`, lang: `Met deze rit ${uren(twee)} rijtijd in twee weken; maximaal 90 uur.` }); break; }
  }

  // Wekelijkse rust: uiterlijk na 6 dagen minstens 24 uur aaneengesloten vrij.
  let reeksBegin = bs[0].start;
  for (let i = 0; i < bs.length; i++) {
    if (i > 0 && bs[i].start - Math.max(...bs.slice(0, i).map((x) => x.eind)) >= WEEKRUST_MIN * 60000) reeksBegin = bs[i].start;
    if (bs[i].ritId === rit.id && bs[i].eind - reeksBegin > ZES_DAGEN_MIN * 60000) {
      uit.push({ kort: "Geen weekrust", lang: "Meer dan 6 dagen achter elkaar zonder 24 uur rust; plan eerst een wekelijkse rust." });
      break;
    }
  }
  return uit;
}
