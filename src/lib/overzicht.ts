import { STATUS, opdrachtgeverLabel, plusDagen, type Afwezigheid, type Medewerker, type Opdrachtgever, type Vak, type VakStatus } from "@/lib/planning";

export type OverzichtMedewerker = Pick<Medewerker, "id" | "naam" | "groep">;

/** Wat er op een dag voor een medewerker geldt: vak gaat voor afwezigheid; leeg op ma–vr is "open" (niet voor kantoor). */
export type DagStand = { status: VakStatus; opdrachtgeverId: string | null } | { status: "open" } | null;

export function dagStand(mw: OverzichtMedewerker, datum: string, dagIndex: number, vak: Vak | undefined, afwezigheid: Afwezigheid[]): DagStand {
  if (vak) return { status: vak.status, opdrachtgeverId: vak.opdrachtgever_id };
  const a = afwezigheid.find((x) => x.medewerker_id === mw.id && x.van <= datum && x.tot_en_met >= datum);
  if (a) return { status: a.soort, opdrachtgeverId: null };
  if (dagIndex < 5 && mw.groep !== "kantoor") return { status: "open" };
  return null;
}

export type BezettingRij = { id: string; naam: string; wie: string[]; perDag: number[]; totaal: number };

export type Overzicht = {
  ingezet: number;
  opdrachtgeversBediend: number;
  beschikbaarAantal: number;
  afwezigAantal: number;
  open: number;
  bezetting: BezettingRij[];
  beschikbaar: string[][];
  afwezig: string[][];
};

export function berekenOverzicht(maandag: string, medewerkers: OverzichtMedewerker[], opdrachtgevers: Pick<Opdrachtgever, "id" | "naam" | "korte_naam">[], vakken: Vak[], afwezigheid: Afwezigheid[]): Overzicht {
  const vakBij = new Map(vakken.map((v) => [`${v.medewerker_id}|${v.datum}`, v]));
  const ogNaam = new Map(opdrachtgevers.map((o) => [o.id, opdrachtgeverLabel(o)]));
  const bezetting = new Map<string, { perDag: number[]; wie: Set<string> }>();
  const beschikbaar: string[][] = Array.from({ length: 7 }, () => []);
  const afwezig: string[][] = Array.from({ length: 7 }, () => []);
  const beschikbaarMw = new Set<string>(), afwezigMw = new Set<string>();
  let ingezet = 0, open = 0;

  for (let i = 0; i < 7; i++) {
    const datum = plusDagen(maandag, i);
    for (const mw of medewerkers) {
      const s = dagStand(mw, datum, i, vakBij.get(`${mw.id}|${datum}`), afwezigheid);
      if (!s) continue;
      if (s.status === "open") {
        open++;
        beschikbaar[i].push(mw.naam);
        beschikbaarMw.add(mw.id);
        continue;
      }
      const soort = STATUS[s.status].soort;
      if (soort === "in") ingezet++;
      if (s.status === "werk" && s.opdrachtgeverId) {
        const b = bezetting.get(s.opdrachtgeverId) ?? { perDag: [0, 0, 0, 0, 0, 0, 0], wie: new Set<string>() };
        b.perDag[i]++;
        b.wie.add(mw.naam);
        bezetting.set(s.opdrachtgeverId, b);
      }
      if (soort === "vrij") { beschikbaar[i].push(mw.naam); beschikbaarMw.add(mw.id); }
      if (soort === "weg") { afwezig[i].push(mw.naam); afwezigMw.add(mw.id); }
    }
  }

  const rijen = [...bezetting].map(([id, b]) => ({
    id, naam: ogNaam.get(id) ?? "Onbekende opdrachtgever", wie: [...b.wie], perDag: b.perDag, totaal: b.perDag.reduce((x, y) => x + y, 0),
  })).sort((a, b) => b.totaal - a.totaal || a.naam.localeCompare(b.naam, "nl"));

  return {
    ingezet, open, bezetting: rijen, beschikbaar, afwezig,
    opdrachtgeversBediend: rijen.length,
    beschikbaarAantal: beschikbaarMw.size,
    afwezigAantal: afwezigMw.size,
  };
}
