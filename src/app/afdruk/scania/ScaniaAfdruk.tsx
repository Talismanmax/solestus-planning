import Blad from "../Blad";
import type { laadScania } from "@/lib/laden";
import { TELEFOON, dagInfo, plusDagen, weekBereik } from "@/lib/planning";
import { ROUTE, deelRegel, ritMeldingen } from "@/lib/scania";
import { gemaaktOp } from "@/lib/tijd";
import { korteNaam } from "@/lib/namen";

export default function ScaniaAfdruk({ week, maandag, d, gebruiker }: {
  week: number; maandag: string; d: Awaited<ReturnType<typeof laadScania>>; gebruiker: { naam: string | null; email: string } | null;
}) {

  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
  const naam = new Map(d.chauffeurs.map((c) => [c.id, c.naam]));
  const eerste = (r: (typeof d.ritten)[number]) => [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde)[0]?.vertrek ?? "";
  const ritten = d.ritten.filter((r) => r.vertrekdatum >= maandag && r.vertrekdatum <= dagen[6])
    .sort((a, b) => a.vertrekdatum.localeCompare(b.vertrekdatum) || eerste(a).localeCompare(eerste(b)));
  const waarsch = new Map(ritten.map((r) => [r.id, ritMeldingen(r, d.ritten, d.afwezigheid, d.vakken).map((m) => m.kort)]));
  const perChauffeur = new Map<string, number>();
  for (const r of ritten) if (r.chauffeur_id) perChauffeur.set(r.chauffeur_id, (perChauffeur.get(r.chauffeur_id) ?? 0) + 1);
  const open = ritten.filter((r) => !r.chauffeur_id).length;
  const door = korteNaam(gebruiker);

  return (
    <Blad stand="liggend" titel={`Scania-ritten week ${week}`} sub={`${weekBereik(maandag)} · ${ROUTE.ishoj.naam} en ${ROUTE.rade.naam}${ritten.some((r) => r.route === "extra") ? " · met extra opdrachten" : ""}`} voet={`Gemaakt op ${gemaaktOp()} door ${door}`}>
      {d.laadFout && <p className="let">De ritten konden niet volledig worden geladen: {d.laadFout}</p>}
      <div className="pcijfers" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="pcijfer"><b>{ritten.length}</b><span>ritten</span></div>
        <div className={`pcijfer${open ? " geel" : ""}`}><b>{open}</b><span>zonder chauffeur</span></div>
        <div className="pcijfer"><b>{perChauffeur.size}</b><span>chauffeurs ingezet</span></div>
        <div className="pcijfer"><b>{[...waarsch.values()].filter((w) => w.length).length}</b><span>met een waarschuwing</span></div>
      </div>

      <table className="pt">
        <colgroup><col style={{ width: 86 }} /><col style={{ width: 70 }} /><col style={{ width: 110 }} /><col /><col /><col style={{ width: 160 }} /><col style={{ width: 190 }} /></colgroup>
        <thead><tr><th>Vertrek</th><th>Dienst</th><th>Route</th><th>Heen</th><th>Terug</th><th>Chauffeur</th><th>Let op</th></tr></thead>
        <tbody>
          {ritten.map((r, k) => {
            const delen = [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde).map(deelRegel);
            const i = dagen.indexOf(r.vertrekdatum);
            const info = dagInfo(r.vertrekdatum, i);
            const nieuweDag = k === 0 || ritten[k - 1].vertrekdatum !== r.vertrekdatum;
            return (
              <tr key={r.id} className={r.route === "extra" ? "pextra" : undefined}>
                <td><b>{nieuweDag ? `${info.kort} ${info.nummer} ${info.maand}` : ""}</b></td>
                <td>{r.route === "extra" ? <span className="pextra-label">EXTRA</span> : <span className={`pdienst${r.dienst === "nacht" ? " nacht" : ""}`}>{r.dienst === "dag" ? "Dag" : "Nacht"}</span>}</td>
                <td>{r.route === "extra" ? <b>{r.omschrijving?.trim() || "Extra opdracht"}</b> : ROUTE[r.route].heen}</td>
                <td>{delen[0] ? <><b style={{ fontWeight: 600 }}>{delen[0].titel}</b><br /><small>{delen[0].tijden}</small></> : "–"}</td>
                <td>{delen.length > 1 ? delen.slice(1).map((d, j) => <div key={j}><b style={{ fontWeight: 600 }}>{d.titel}</b><br /><small>{d.tijden}</small></div>) : r.route === "rade" ? "Swap in Rade" : "–"}</td>
                <td className={r.chauffeur_id ? undefined : "pgeel"}><b>{r.chauffeur_id ? naam.get(r.chauffeur_id) ?? "Onbekend" : "Nog geen chauffeur"}</b>{r.notitie && <><br /><small>{r.notitie}</small></>}</td>
                <td>{waarsch.get(r.id)!.map((w) => <div key={w} className="let">(!) {w}</div>)}</td>
              </tr>
            );
          })}
          {ritten.length === 0 && <tr><td colSpan={7}>Geen ritten gepland in deze week.</td></tr>}
        </tbody>
      </table>

      <div className="twee">
        <section>
          <h2 className="ptitel">Chauffeurs deze week</h2>
          <div className="plijst">
            {[...perChauffeur].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
              <div key={id} style={{ gridTemplateColumns: "1fr auto" }}><span>{naam.get(id) ?? "Onbekend"}</span><b>{n} {n === 1 ? "rit" : "ritten"}</b></div>
            ))}
            {perChauffeur.size === 0 && <div style={{ gridTemplateColumns: "1fr" }}>Nog geen chauffeurs ingepland.</div>}
          </div>
        </section>
        <section>
          <h2 className="ptitel">Toelichting</h2>
          <p style={{ margin: "0 0 6px", fontSize: 11 }}>Dag = vertrek 09.00 · Nacht = vertrek 21.00. Bij Rade (swap) staat de hele rit onder Heen. EXTRA = extra opdracht van Scania naast de vaste ritten (bijv. pendelen).</p>
          <p style={{ margin: 0, fontSize: 11 }}>Nog geen chauffeur = rit staat open. Vragen over een rit? Bel {TELEFOON.nl}.</p>
        </section>
      </div>
    </Blad>
  );
}
