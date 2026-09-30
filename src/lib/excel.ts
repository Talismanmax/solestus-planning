import { berekenOverzicht, type OverzichtMedewerker } from "@/lib/overzicht";
import {
  GROEPEN, STATUS_HEX, celInhoud, dagInfo, plusDagen, weekParam,
  type Afwezigheid, type Medewerker, type Opdrachtgever, type Vak, type WeekOpmerking,
} from "@/lib/planning";

// Excel-bestanden worden in de browser gemaakt; de bibliotheek wordt pas geladen bij het exporteren.
async function bewaar(bladen: { naam: string; data: unknown[][]; kolommen: number[]; vast?: number }[], bestand: string) {
  const { default: schrijf } = await import("write-excel-file/browser");
  type Blad = Parameters<typeof schrijf>[0] & unknown[];
  const sheets = bladen.map((b) => ({ sheet: b.naam, data: b.data, columns: b.kolommen.map((width) => ({ width })), stickyRowsCount: b.vast ?? 1 }));
  await schrijf(sheets as unknown as Blad).toFile(bestand);
}

/** Tekst die met = + - @ begint, zou in een spreadsheet als formule kunnen worden gelezen: met ' ervoor blijft het tekst. */
const tekst = (t: string) => (/^[=+\-@]/.test(t) ? `'${t}` : t);

const kop = (value: string) => ({ value, fontWeight: "bold" as const, backgroundColor: "#EBECE8" });

export async function weekNaarExcel(p: {
  week: number; maandag: string; groep: string;
  medewerkers: Medewerker[]; opdrachtgevers: Opdrachtgever[]; vakken: Vak[]; afwezigheid: Afwezigheid[]; opmerkingen: WeekOpmerking[];
}) {
  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(p.maandag, i));
  const ogById = new Map(p.opdrachtgevers.map((o) => [o.id, o]));
  const vakBij = new Map(p.vakken.map((v) => [`${v.medewerker_id}|${v.datum}`, v]));
  const opm = new Map(p.opmerkingen.map((o) => [o.medewerker_id, o.tekst]));
  const data: unknown[][] = [[
    kop("Medewerker"), kop("Groep"), kop("BV"),
    ...dagen.map((d, i) => { const x = dagInfo(d, i); return kop(`${x.kort} ${x.nummer} ${x.maand}`); }),
    kop("Opmerking"),
  ]];
  for (const g of GROEPEN) {
    if (p.groep !== "alle" && p.groep !== g.id) continue;
    for (const m of p.medewerkers.filter((x) => x.groep === g.id)) {
      data.push([
        { value: tekst(m.naam), fontWeight: "bold" }, g.label, m.bv ?? "",
        ...dagen.map((d, i) => {
          const c = celInhoud(m, d, i, vakBij.get(`${m.id}|${d}`), p.afwezigheid, ogById);
          const inhoud = tekst([c.conflict ? "(!) " : "", c.label, c.sub ? ` · ${c.sub}` : ""].join(""));
          return c.status ? { value: inhoud, backgroundColor: STATUS_HEX[c.status].bg, textColor: STATUS_HEX[c.status].fg, fontStyle: c.periode ? "italic" : undefined } : inhoud;
        }),
        tekst(opm.get(m.id) ?? ""),
      ]);
    }
  }
  await bewaar([{ naam: `Week ${p.week}`, data, kolommen: [26, 22, 18, 20, 20, 20, 20, 20, 16, 16, 34] }], `Weekplanning ${weekParam(p.maandag)}.xlsx`);
}

export async function overzichtNaarExcel(p: {
  week: number; maandag: string;
  medewerkers: OverzichtMedewerker[]; opdrachtgevers: Pick<Opdrachtgever, "id" | "naam" | "korte_naam">[]; vakken: Vak[]; afwezigheid: Afwezigheid[];
}) {
  const o = berekenOverzicht(p.maandag, p.medewerkers, p.opdrachtgevers, p.vakken, p.afwezigheid);
  const dagen = Array.from({ length: 7 }, (_, i) => dagInfo(plusDagen(p.maandag, i), i));
  const data: unknown[][] = [[kop("Opdrachtgever"), ...dagen.map((d) => kop(`${d.kort} ${d.nummer} ${d.maand}`)), kop("Totaal"), kop("Medewerkers")]];
  for (const r of o.bezetting) data.push([{ value: tekst(r.naam), fontWeight: "bold" }, ...r.perDag, { value: r.totaal, fontWeight: "bold" }, tekst(r.wie.join(", "))]);
  const som = (i: number) => o.bezetting.reduce((a, r) => a + r.perDag[i], 0);
  data.push([kop("Totaal"), ...dagen.map((_, i) => ({ ...kop(""), value: som(i) })), { ...kop(""), value: o.bezetting.reduce((a, r) => a + r.totaal, 0) }, kop("")]);
  await bewaar([{ naam: `Bezetting week ${p.week}`, data, kolommen: [32, 10, 10, 10, 10, 10, 10, 10, 10, 60] }], `Bezetting ${weekParam(p.maandag)}.xlsx`);
}
