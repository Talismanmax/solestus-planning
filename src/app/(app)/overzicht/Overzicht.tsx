"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "./overzicht.css";
import AfwezigheidPaneel from "@/components/AfwezigheidPaneel";
import ExportMenu from "@/components/ExportMenu";
import { overzichtNaarExcel } from "@/lib/excel";
import type { AfwezigheidMetNaam } from "@/lib/laden";
import { berekenOverzicht, type OverzichtMedewerker } from "@/lib/overzicht";
import { STATUS, aantalDagen, periodeKort, plusDagen, vandaagNL, weekBereik, weekParam, type Afwezigheid, type Opdrachtgever, type Vak } from "@/lib/planning";

type Props = {
  week: number; maandag: string;
  medewerkers: OverzichtMedewerker[]; opdrachtgevers: Pick<Opdrachtgever, "id" | "naam" | "korte_naam">[];
  vakken: Vak[]; afwezigheid: AfwezigheidMetNaam[];
  magWijzigen: boolean; laadFout: string | null;
};

const DAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export default function Overzicht(p: Props) {
  const router = useRouter();
  const [paneel, setPaneel] = useState<{ bestaand: Afwezigheid | null } | null>(null);
  const [toast, setToast] = useState<{ tekst: string; fout?: boolean } | null>(null);

  const o = berekenOverzicht(p.maandag, p.medewerkers, p.opdrachtgevers, p.vakken, p.afwezigheid);
  const max = Math.max(1, ...o.bezetting.map((r) => r.totaal));
  const wp = weekParam(p.maandag);
  const vorigeWeek = weekParam(plusDagen(p.maandag, -7));
  const volgendeWeek = weekParam(plusDagen(p.maandag, 7));
  const vandaag = vandaagNL();
  const standaardVan = vandaag >= p.maandag && vandaag <= plusDagen(p.maandag, 6) ? vandaag : p.maandag;

  function klaar(tekst: string, fout = false) {
    if (!fout) setPaneel(null);
    setToast({ tekst, fout });
    setTimeout(() => setToast(null), fout ? 6000 : 2500);
    router.refresh();
  }

  return (
    <main className="pagina">
      <div className="kop">
        <div>
          <h1 className="machina">Overzicht</h1>
          <div className="kop-meta">Bezetting en beschikbaarheid in week {p.week} · {weekBereik(p.maandag)}</div>
        </div>
        <div className="weekkiezer">
          <Link className="icoonknop" href={`/overzicht?week=${vorigeWeek}`} aria-label="Vorige week"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></Link>
          <Link className="knop" href="/overzicht">Deze week</Link>
          <Link className="icoonknop" href={`/overzicht?week=${volgendeWeek}`} aria-label="Volgende week"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></Link>
          <ExportMenu
            uitleg={`Het overzicht van week ${p.week}.`}
            keuzes={[
              { titel: "PDF, A4 liggend", sub: "cijfers, bezetting en afwezigheid", href: `/afdruk/overzicht?week=${wp}`, soort: "liggend" },
              { titel: "Excel", sub: "bezetting per opdrachtgever per dag", onClick: () => overzichtNaarExcel(p), soort: "excel" },
            ]}
          />
        </div>
      </div>

      {p.laadFout && <div className="melding melding-fout" role="alert" style={{ maxWidth: "none", marginBottom: 14 }}><strong>Laden is niet gelukt</strong>{p.laadFout}</div>}

      <div className="cijfers">
        <div className="cijfer"><b>{o.ingezet}</b><span>Ingezette diensten</span></div>
        <div className="cijfer"><b>{o.opdrachtgeversBediend}</b><span>Opdrachtgevers bediend</span></div>
        <div className="cijfer"><b>{o.beschikbaarAantal}</b><span>Niet ingezet, beschikbaar</span></div>
        <div className="cijfer"><b>{o.afwezigAantal}</b><span>Afwezig of niet beschikbaar</span></div>
        <Link className="cijfer cijfer-geel" href={`/?week=${wp}`}><b>{o.open}</b><span>Open vakken ma–vr</span></Link>
      </div>

      <section className="blok bezetting" aria-labelledby="h-bez">
        <div className="blok-kop"><h2 id="h-bez">Bezetting per opdrachtgever</h2><span>diensten per dag</span></div>
        <div className="bez-rij bez-kop" aria-hidden="true">
          <span>Opdrachtgever</span>{DAGEN.map((d) => <span key={d}>{d}</span>)}<span>Totaal</span><span />
        </div>
        {o.bezetting.map((r) => (
          <div key={r.id} className="bez-rij">
            <span className="bez-naam"><b>{r.naam}</b><small>{r.wie.join(", ")}</small></span>
            {r.perDag.map((v, i) => <span key={i} aria-label={`${DAGEN[i]}: ${v}`}>{v || "–"}</span>)}
            <span className="bez-totaal">{r.totaal}</span>
            <span className="balk" aria-hidden="true"><i style={{ width: `${Math.round((r.totaal / max) * 100)}%` }} /></span>
          </div>
        ))}
        {o.bezetting.length === 0 && <div className="bez-rij" style={{ gridTemplateColumns: "1fr" }}>Nog niemand ingezet bij een opdrachtgever in deze week.</div>}
      </section>

      <div className="drieluik">
        <DagLijst id="h-besch" titel="Beschikbaar" sub="niet ingezet of open" lijsten={o.beschikbaar} />
        <DagLijst id="h-afw" titel="Afwezig" sub="vakantie, ziek, vrij" lijsten={o.afwezig} />
        <section className="blok" aria-labelledby="h-per">
          <div className="periode-kop">
            <h2 id="h-per">Afwezigheid</h2>
            {p.magWijzigen && <button type="button" className="knop knop-zwart" onClick={() => setPaneel({ bestaand: null })}>Toevoegen</button>}
          </div>
          {p.afwezigheid.map((a) => {
            const s = STATUS[a.soort];
            const n = aantalDagen(a.van, a.tot_en_met);
            const inhoud = <>
              <span><b>{a.naam}</b><span className="soort" style={{ background: s.bg, color: s.fg }}>{s.label}</span></span>
              <span>{periodeKort(a.van, a.tot_en_met)} · {n} {n === 1 ? "dag" : "dagen"}{a.notitie ? ` · ${a.notitie}` : ""}</span>
            </>;
            return p.magWijzigen
              ? <button key={a.id} type="button" className="periode" onClick={() => setPaneel({ bestaand: a })}>{inhoud}</button>
              : <div key={a.id} className="periode">{inhoud}</div>;
          })}
          {p.afwezigheid.length === 0 && <div className="periode">Geen afwezigheid ingevoerd voor deze week.</div>}
        </section>
      </div>

      {paneel && (
        <AfwezigheidPaneel
          key={paneel.bestaand?.id ?? "nieuw"}
          medewerkers={paneel.bestaand ? [{ id: paneel.bestaand.medewerker_id, naam: (paneel.bestaand as AfwezigheidMetNaam).naam }] : p.medewerkers}
          bestaand={paneel.bestaand}
          standaardVan={standaardVan}
          onSluit={() => setPaneel(null)}
          onKlaar={klaar}
        />
      )}
      {toast && <div className={`toast${toast.fout ? " fout" : ""}`} role="status">{toast.tekst}</div>}
    </main>
  );
}

function DagLijst({ id, titel, sub, lijsten }: { id: string; titel: string; sub: string; lijsten: string[][] }) {
  return (
    <section className="blok" aria-labelledby={id}>
      <div className="blok-kop" style={{ paddingBottom: 8 }}><h2 id={id}>{titel}</h2><span>{sub}</span></div>
      {lijsten.map((namen, i) => (
        <div key={i} className="dag-rij">
          <b>{DAGEN[i]}</b>
          <span style={{ fontWeight: namen.length ? 600 : 400 }}>{namen.length ? namen.join(", ") : "niemand"}</span>
          <b>{namen.length || ""}</b>
        </div>
      ))}
    </section>
  );
}
