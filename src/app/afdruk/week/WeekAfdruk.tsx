import Blad from "../Blad";
import type { laadWeek } from "@/lib/laden";
import { DAG_LANG, GROEPEN, STATUS, STATUS_VOLGORDE, celInhoud, dagInfo, dagTelling, opdrachtgeverLabel, plusDagen, weekBereik, type Medewerker } from "@/lib/planning";
import { gemaaktOp, tijdstipNL } from "@/lib/tijd";
import { korteNaam } from "@/lib/namen";


export default function WeekAfdruk({ week, maandag, stand, groepId, ogId, bv, d, gebruiker }: {
  week: number; maandag: string; stand: "liggend" | "staand"; groepId?: string; ogId?: string; bv?: string;
  d: Awaited<ReturnType<typeof laadWeek>>; gebruiker: { naam: string | null; email: string } | null;
}) {
  const groep = GROEPEN.find((x) => x.id === groepId);

  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
  const ogById = new Map(d.opdrachtgevers.map((o) => [o.id, o]));
  const vakBij = new Map(d.vakken.map((v) => [`${v.medewerker_id}|${v.datum}`, v]));
  const opm = new Map(d.opmerkingen.map((o) => [o.medewerker_id, o.tekst]));
  const ogFilter = ogId ? d.opdrachtgevers.find((o) => o.id === ogId) : undefined;
  const mws = d.medewerkers.filter((m) => (!groep || m.groep === groep.id) && (!bv || m.bv === bv)
    && (!ogFilter || d.vakken.some((v) => v.medewerker_id === m.id && v.opdrachtgever_id === ogFilter.id)));
  const cel = (m: Medewerker, i: number) => celInhoud(m, dagen[i], i, vakBij.get(`${m.id}|${dagen[i]}`), d.afwezigheid, ogById);
  const telling = dagen.map((_, i) => dagTelling(mws.map((m) => cel(m, i))));
  const liggend = stand === "liggend";
  const kolommen = 8 + (liggend ? 1 : 0);

  const door = korteNaam(gebruiker);
  const voet = `Gemaakt op ${gemaaktOp()} door ${door}${liggend && d.laatstGewijzigd ? ` · laatst gewijzigd ${tijdstipNL(d.laatstGewijzigd.tijdstip)}` : ""}`;
  const filter = [groep ? groep.label : "Alle groepen", ogFilter ? opdrachtgeverLabel(ogFilter) : "Alle opdrachtgevers", bv ?? "Alle BV's"].join(" · ");

  return (
    <Blad
      stand={stand}
      titel={`Weekplanning week ${week}`}
      sub={liggend ? `${weekBereik(maandag)} · ${filter}` : <>{filter}<br /><b style={{ fontSize: 13 }}>{weekBereik(maandag)}</b></>}
      voet={voet}
    >
      {d.laadFout && <p className="let">De planning kon niet volledig worden geladen: {d.laadFout}</p>}
      <table className="pt">
        <colgroup>
          <col style={{ width: liggend ? 150 : 130 }} />
          {dagen.map((x, i) => <col key={x} style={i >= 5 ? { width: liggend ? 76 : 50 } : undefined} />)}
          {liggend && <col style={{ width: 100 }} />}
        </colgroup>
        <thead>
          <tr>
            <th>Medewerker</th>
            {dagen.map((x, i) => { const info = dagInfo(x, i); return <th key={x}>{liggend ? DAG_LANG[i] : info.kort}<small>{info.nummer} {info.maand}</small></th>; })}
            {liggend && <th>Opmerking</th>}
          </tr>
          <tr>
            <th style={{ background: "var(--wit)", fontWeight: 400 }}>{liggend ? "Bezetting" : "Ingezet"}</th>
            {telling.map((t, i) => <th key={i} style={{ background: "var(--wit)", fontWeight: 400 }}><b>{t.inzet}</b>{liggend ? " in" : ""}{t.open > 0 && ` · ${t.open} open`}</th>)}
            {liggend && <th style={{ background: "var(--wit)" }} />}
          </tr>
        </thead>
        <tbody>
          {GROEPEN.map((gr) => {
            const lijst = mws.filter((m) => m.groep === gr.id);
            if (!lijst.length) return null;
            return [
              <tr key={gr.id} className="groep"><td colSpan={kolommen}>{gr.label} · {lijst.length}</td></tr>,
              ...lijst.map((m) => (
                <tr key={m.id}>
                  <td className="pnaam"><b>{m.naam}</b><small>{m.certificaten.join(" · ")}</small></td>
                  {dagen.map((x, i) => {
                    const c = cel(m, i);
                    if (!c.label) return <td key={x} className="cel" />;
                    return (
                      <td key={x} className="cel">
                        <div className={`pvak${c.periode ? " periode" : ""}${c.open ? " open" : ""}`} style={{ background: c.open ? "var(--wit)" : c.bg, color: c.fg }}>
                          <span style={liggend ? undefined : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}{c.conflict && " (!)"}</span>
                          {c.sub && <small>{c.sub}</small>}
                        </div>
                      </td>
                    );
                  })}
                  {liggend && <td style={{ fontSize: 11 }}>{opm.get(m.id) ?? ""}</td>}
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>

      {!liggend && mws.some((m) => opm.has(m.id)) && (
        <section>
          <h2 className="ptitel">Opmerkingen deze week</h2>
          <div className="plijst">
            {mws.filter((m) => opm.has(m.id)).map((m) => <div key={m.id} style={{ gridTemplateColumns: "150px 1fr" }}><b>{m.naam}</b><span>{opm.get(m.id)}</span></div>)}
          </div>
        </section>
      )}

      <div>
        <div className="legenda">
          <b>Legenda</b>
          {STATUS_VOLGORDE.filter((x) => x !== "werk").map((x) => <span key={x} className="pil" style={{ background: STATUS[x].bg, color: STATUS[x].fg }}>{STATUS[x].label}</span>)}
        </div>
        <p className="toelichting" style={{ margin: "4px 0 0" }}><i>Cursief</i> = afwezigheid uit een periode · (!) = ingepland tijdens afwezigheid · Open = nog niet gepland</p>
      </div>
    </Blad>
  );
}
