import Blad from "../Blad";
import type { laadOverzicht } from "@/lib/laden";
import { berekenOverzicht } from "@/lib/overzicht";
import { STATUS, aantalDagen, periodeKort, weekBereik } from "@/lib/planning";
import { gemaaktOp } from "@/lib/tijd";

const DAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function DagLijst({ titel, sub, lijsten }: { titel: string; sub: string; lijsten: string[][] }) {
  return (
    <section>
      <h2 className="ptitel">{titel} <span>· {sub}</span></h2>
      <div className="plijst">
        {lijsten.map((namen, i) => (
          <div key={i}><b>{DAGEN[i]}</b><span style={{ fontWeight: namen.length ? 600 : 400 }}>{namen.length ? namen.join(", ") : "niemand"}</span><b>{namen.length || ""}</b></div>
        ))}
      </div>
    </section>
  );
}

export default function OverzichtAfdruk({ week, maandag, d, gebruiker }: {
  week: number; maandag: string; d: Awaited<ReturnType<typeof laadOverzicht>>; gebruiker: { naam: string | null; email: string } | null;
}) {
  const o = berekenOverzicht(maandag, d.medewerkers, d.opdrachtgevers, d.vakken, d.afwezigheid);
  const door = gebruiker?.naam?.split(" ")[0] || gebruiker?.email.split("@")[0] || "onbekend";

  return (
    <Blad stand="liggend" titel={`Overzicht week ${week}`} sub={`${weekBereik(maandag)} · bezetting en beschikbaarheid`} voet={`Gemaakt op ${gemaaktOp()} door ${door}`}>
      {d.laadFout && <p className="let">Het overzicht kon niet volledig worden geladen: {d.laadFout}</p>}
      <div className="pcijfers" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="pcijfer"><b>{o.ingezet}</b><span>ingezette diensten</span></div>
        <div className="pcijfer"><b>{o.opdrachtgeversBediend}</b><span>opdrachtgevers bediend</span></div>
        <div className="pcijfer"><b>{o.beschikbaarAantal}</b><span>niet ingezet, beschikbaar</span></div>
        <div className="pcijfer"><b>{o.afwezigAantal}</b><span>afwezig of niet beschikbaar</span></div>
        <div className="pcijfer geel"><b>{o.open}</b><span>open vakken ma–vr</span></div>
      </div>

      <section>
        <h2 className="ptitel">Bezetting per opdrachtgever <span>· diensten per dag</span></h2>
        <table className="pt">
          <colgroup><col style={{ width: 200 }} />{DAGEN.map((x) => <col key={x} style={{ width: 52 }} />)}<col style={{ width: 62 }} /><col /></colgroup>
          <thead><tr><th>Opdrachtgever</th>{DAGEN.map((x) => <th key={x} className="getal">{x}</th>)}<th className="getal">Totaal</th><th>Medewerkers</th></tr></thead>
          <tbody>
            {o.bezetting.map((r) => (
              <tr key={r.id}>
                <td><b>{r.naam}</b></td>
                {r.perDag.map((v, i) => <td key={i} className="getal">{v || "–"}</td>)}
                <td className="getal"><b>{r.totaal}</b></td>
                <td>{r.wie.join(", ")}</td>
              </tr>
            ))}
            {o.bezetting.length === 0 && <tr><td colSpan={10}>Nog niemand ingezet bij een opdrachtgever in deze week.</td></tr>}
          </tbody>
        </table>
      </section>

      <div className="drie">
        <DagLijst titel="Beschikbaar" sub="niet ingezet of open" lijsten={o.beschikbaar} />
        <DagLijst titel="Afwezig" sub="vakantie, ziek, vrij" lijsten={o.afwezig} />
        <section>
          <h2 className="ptitel">Afwezigheid <span>· lopend en gepland</span></h2>
          <div className="plijst">
            {d.afwezigheid.map((a) => {
              const n = aantalDagen(a.van, a.tot_en_met);
              return (
                <div key={a.id} style={{ gridTemplateColumns: "1fr auto", rowGap: 2 }}>
                  <b>{a.naam}</b><span className="soort-pil" style={{ background: STATUS[a.soort].bg, color: STATUS[a.soort].fg }}>{STATUS[a.soort].label}</span>
                  <span style={{ gridColumn: "1 / -1" }}>{periodeKort(a.van, a.tot_en_met)} · {n} {n === 1 ? "dag" : "dagen"}{a.notitie ? ` · ${a.notitie}` : ""}</span>
                </div>
              );
            })}
            {d.afwezigheid.length === 0 && <div style={{ gridTemplateColumns: "1fr" }}>Geen afwezigheid in deze week.</div>}
          </div>
        </section>
      </div>
    </Blad>
  );
}
