"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ExportMenu from "@/components/ExportMenu";
import PaneelSchil from "@/components/PaneelSchil";
import { weekNaarExcel } from "@/lib/excel";
import { createClient } from "@/lib/supabase/client";
import {
  GROEPEN, STATUS, STATUS_VOLGORDE, celInhoud, dagInfo, dagTelling, plusDagen, tijdstipNL, vandaagNL, weekBereik, weekParam,
  type Afwezigheid, type Medewerker, type Opdrachtgever, type Vak, type VakStatus, type WeekOpmerking,
} from "@/lib/planning";

type Props = {
  jaar: number; week: number; maandag: string;
  medewerkers: Medewerker[]; opdrachtgevers: Opdrachtgever[]; vakken: Vak[];
  afwezigheid: Afwezigheid[]; opmerkingen: WeekOpmerking[];
  magWijzigen: boolean; laatstGewijzigd: { tijdstip: string; door: string } | null; laadFout: string | null;
};

type Paneel =
  | { soort: "vak"; mw: Medewerker; dag: number }
  | { soort: "opmerking"; mw: Medewerker }
  | null;

const sleutel = (mwId: string, datum: string) => `${mwId}|${datum}`;

export default function Weekplanning(p: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [vakken, setVakken] = useState<Map<string, Vak>>(() => new Map(p.vakken.map((v) => [sleutel(v.medewerker_id, v.datum), v])));
  const [opmerkingen, setOpmerkingen] = useState<Map<string, WeekOpmerking>>(() => new Map(p.opmerkingen.map((o) => [o.medewerker_id, o])));
  const [paneel, setPaneel] = useState<Paneel>(null);
  const [zoek, setZoek] = useState("");
  const [groep, setGroep] = useState<string>("alle");
  const [legenda, setLegenda] = useState(false);
  const [toast, setToast] = useState<{ tekst: string; fout?: boolean } | null>(null);

  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(p.maandag, i));
  const vandaag = vandaagNL();
  const ogById = useMemo(() => new Map(p.opdrachtgevers.map((o) => [o.id, o])), [p.opdrachtgevers]);
  const voorbeeld = p.opdrachtgevers.some((o) => o.naam.includes("(voorbeeld)"));

  function melding(tekst: string, fout = false) {
    setToast({ tekst, fout });
    setTimeout(() => setToast(null), fout ? 6000 : 2500);
  }

  function afwezigOp(mwId: string, datum: string) {
    return p.afwezigheid.find((a) => a.medewerker_id === mwId && a.van <= datum && a.tot_en_met >= datum);
  }

  const cel = (mw: Medewerker, datum: string, i: number) => celInhoud(mw, datum, i, vakken.get(sleutel(mw.id, datum)), p.afwezigheid, ogById);

  const zichtbaar = p.medewerkers.filter((m) =>
    (groep === "alle" || m.groep === groep) && (!zoek || m.naam.toLowerCase().includes(zoek.toLowerCase())));

  const telling = dagen.map((d, i) => dagTelling(p.medewerkers.map((m) => cel(m, d, i))));

  async function logWijziging(omschrijving: string, tabel: string, recordId?: string) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("wijzigingen").insert({ gebruiker_id: data.user.id, omschrijving, tabel, record_id: recordId ?? null });
  }

  async function slaVakOp(mw: Medewerker, datum: string, status: VakStatus | null, opdrachtgeverId: string | null, notitie: string) {
    const k = sleutel(mw.id, datum);
    const oud = vakken.get(k);
    const lang = dagInfo(datum, dagen.indexOf(datum)).lang.toLowerCase();
    const { data: auth } = await supabase.auth.getUser();

    if (status === null) {
      if (!oud) { setPaneel(null); return; }
      const next = new Map(vakken); next.delete(k); setVakken(next);
      setPaneel(null);
      const { error } = await supabase.from("vakken").delete().eq("id", oud.id);
      if (error) { setVakken(new Map(vakken)); melding("Opslaan is niet gelukt. Probeer het opnieuw.", true); return; }
      await logWijziging(`${mw.naam} ${lang}: leeggemaakt`, "vakken", oud.id);
      melding("Vak leeggemaakt");
      return;
    }

    const rij = { medewerker_id: mw.id, datum, status, opdrachtgever_id: status === "werk" ? opdrachtgeverId : null, notitie: notitie.trim() || null, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() };
    const tijdelijk: Vak = { id: oud?.id ?? "nieuw", ...rij };
    const vorige = new Map(vakken);
    setVakken(new Map(vakken).set(k, tijdelijk));
    setPaneel(null);
    const { data, error } = await supabase.from("vakken").upsert(rij, { onConflict: "medewerker_id,datum" }).select("id, medewerker_id, datum, status, opdrachtgever_id, notitie").single();
    if (error || !data) { setVakken(vorige); melding("Opslaan is niet gelukt. Je wijziging is niet bewaard.", true); return; }
    setVakken((m) => new Map(m).set(k, data as Vak));
    const og = rij.opdrachtgever_id ? ogById.get(rij.opdrachtgever_id)?.naam : null;
    await logWijziging(`${mw.naam} ${lang}: ${og ?? STATUS[status].label}${rij.notitie ? ` (${rij.notitie})` : ""}`, "vakken", data.id);
    melding("Opgeslagen");
  }

  async function slaOpmerkingOp(mw: Medewerker, tekst: string) {
    const oud = opmerkingen.get(mw.id);
    const vorige = new Map(opmerkingen);
    setPaneel(null);
    if (!tekst.trim()) {
      if (!oud) return;
      const next = new Map(opmerkingen); next.delete(mw.id); setOpmerkingen(next);
      const { error } = await supabase.from("week_opmerkingen").delete().eq("id", oud.id);
      if (error) { setOpmerkingen(vorige); melding("Opslaan is niet gelukt.", true); return; }
      await logWijziging(`${mw.naam}: opmerking week ${p.week} verwijderd`, "week_opmerkingen", oud.id);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const rij = { medewerker_id: mw.id, jaar: p.jaar, week: p.week, tekst: tekst.trim(), gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() };
    setOpmerkingen(new Map(opmerkingen).set(mw.id, { id: oud?.id ?? "nieuw", medewerker_id: mw.id, tekst: rij.tekst }));
    const q = oud
      ? supabase.from("week_opmerkingen").update(rij).eq("id", oud.id).select("id, medewerker_id, tekst").single()
      : supabase.from("week_opmerkingen").insert(rij).select("id, medewerker_id, tekst").single();
    const { data, error } = await q;
    if (error || !data) { setOpmerkingen(vorige); melding("Opslaan is niet gelukt.", true); return; }
    setOpmerkingen((m) => new Map(m).set(mw.id, data as WeekOpmerking));
    await logWijziging(`${mw.naam}: opmerking "${rij.tekst}"`, "week_opmerkingen", data.id);
    melding("Opgeslagen");
  }

  const vorigeWeek = weekParam(plusDagen(p.maandag, -7));
  const volgendeWeek = weekParam(plusDagen(p.maandag, 7));
  const meta = p.laadFout
    ? "De planning kon niet worden geladen."
    : !p.magWijzigen
      ? "Je kunt deze planning bekijken, maar niet wijzigen."
      : p.laatstGewijzigd ? `Laatst gewijzigd door ${p.laatstGewijzigd.door} · ${tijdstipNL(p.laatstGewijzigd.tijdstip)}` : "Nog geen wijzigingen";

  return (
    <main className="pagina">
      <div className="kop">
        <div>
          <h1 className="machina">Week {p.week} <span style={{ fontFamily: "Fustat", fontWeight: 400, fontSize: 18 }}>{weekBereik(p.maandag)}</span></h1>
          <div className="kop-meta">{meta}</div>
        </div>
        <div className="weekkiezer">
          <Link className="icoonknop" href={`/?week=${vorigeWeek}`} aria-label="Vorige week"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></Link>
          <Link className="knop" href="/">Deze week</Link>
          <Link className="icoonknop" href={`/?week=${volgendeWeek}`} aria-label="Volgende week"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></Link>
        </div>
      </div>

      {voorbeeld && <div className="voorbeeld">Je ziet voorbeeldgegevens. Zodra de koppeling met Easyflex2go draait, komen hier de echte medewerkers en opdrachtgevers.</div>}
      {p.laadFout && <div className="melding melding-fout" role="alert" style={{ maxWidth: "none", marginBottom: 14 }}><strong>Laden is niet gelukt</strong>{p.laadFout}</div>}

      <div className="werkbalk">
        <input className="zoek" type="search" placeholder="Zoek medewerker" aria-label="Zoek medewerker" value={zoek} onChange={(e) => setZoek(e.target.value)} />
        <div className="seg" role="group" aria-label="Groep">
          <button type="button" aria-pressed={groep === "alle"} onClick={() => setGroep("alle")}>Iedereen</button>
          {GROEPEN.map((g) => <button key={g.id} type="button" aria-pressed={groep === g.id} onClick={() => setGroep(g.id)}>{g.label}</button>)}
        </div>
        <button type="button" className="icoonknop" aria-label="Legenda" onClick={() => setLegenda(true)} style={{ fontWeight: 800 }}>?</button>
        <div style={{ flexGrow: 1 }} />
        <ExportMenu
          uitleg={`Week ${p.week}${groep === "alle" ? "" : `, alleen ${GROEPEN.find((g) => g.id === groep)?.label}`}.`}
          keuzes={[
            { titel: "PDF, A4 liggend", sub: "hele week op één pagina", href: `/afdruk/week?week=${weekParam(p.maandag)}&groep=${groep}&stand=liggend`, soort: "liggend" },
            { titel: "PDF, A4 staand", sub: "compact, met opmerkingen eronder", href: `/afdruk/week?week=${weekParam(p.maandag)}&groep=${groep}&stand=staand`, soort: "staand" },
            { titel: "Excel", sub: "om verder te rekenen of te delen", onClick: () => weekNaarExcel({ ...p, vakken: [...vakken.values()], opmerkingen: [...opmerkingen.values()], groep }), soort: "excel" },
          ]}
        />
      </div>

      <div className="rooster">
        <table>
          <thead>
            <tr>
              <th className="col-naam" scope="col">Medewerker</th>
              {dagen.map((d, i) => {
                const info = dagInfo(d, i);
                return (
                  <th key={d} scope="col" className={d === vandaag ? "vandaag" : undefined}>
                    <span className="dagkop">
                      <span>{info.kort} {info.nummer} {info.maand}</span>
                      <small>{telling[i].inzet} ingezet{telling[i].open > 0 && <span className="open">{telling[i].open} open</span>}</small>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {GROEPEN.map((g) => {
              const lijst = zichtbaar.filter((m) => m.groep === g.id);
              if (!lijst.length) return null;
              return [
                <tr key={g.id} className="groep"><td colSpan={8}>{g.label} · {lijst.length}</td></tr>,
                ...lijst.map((m) => {
                  const opm = opmerkingen.get(m.id);
                  return (
                    <tr key={m.id}>
                      <th scope="row" className="naamcel" style={{ fontWeight: "normal", textAlign: "left" }}>
                        <span className="naam">{m.naam}</span>
                        {m.certificaten.length > 0 && (
                          <span className="labels">{m.certificaten.map((c) => <span key={c} className={`label${/ADR/.test(c) ? " label-adr" : ""}`}>{c}</span>)}</span>
                        )}
                        {(opm || p.magWijzigen) && (
                          <button type="button" className="notitie" disabled={!p.magWijzigen} onClick={() => setPaneel({ soort: "opmerking", mw: m })} aria-label={`Opmerking week ${p.week} voor ${m.naam}`}>
                            {opm ? opm.tekst : <span style={{ opacity: 0.55 }}>+ opmerking</span>}
                          </button>
                        )}
                      </th>
                      {dagen.map((d, i) => {
                        const c = cel(m, d, i);
                        const gekozen = paneel?.soort === "vak" && paneel.mw.id === m.id && paneel.dag === i;
                        return (
                          <td key={d} className={`dagcel${i >= 5 ? " weekend" : ""}`}>
                            <button
                              type="button"
                              className={`vak${c.open ? " leeg-open" : ""}${gekozen ? " gekozen" : ""}${c.periode ? " periode" : ""}`}
                              style={{ background: c.bg, color: c.fg }}
                              disabled={!p.magWijzigen}
                              onClick={() => setPaneel({ soort: "vak", mw: m, dag: i })}
                              aria-label={`${m.naam}, ${dagInfo(d, i).lang}: ${c.label || "leeg"}${c.sub ? ", " + c.sub : ""}${c.conflict ? ", ingepland tijdens afwezigheid" : ""}`}
                            >
                              {c.conflict && <span className="conflict" title="Ingepland tijdens afwezigheid" aria-hidden="true">!</span>}
                              {c.label}
                              {c.sub && <small>{c.sub}</small>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
        {zichtbaar.length === 0 && <div className="leeg-staat">Geen medewerkers gevonden.</div>}
      </div>

      {paneel?.soort === "vak" && (
        <VakPaneel
          key={`${paneel.mw.id}-${paneel.dag}`}
          mw={paneel.mw}
          datum={dagen[paneel.dag]}
          dagLabel={dagInfo(dagen[paneel.dag], paneel.dag).lang}
          week={p.week}
          huidig={vakken.get(sleutel(paneel.mw.id, dagen[paneel.dag])) ?? null}
          afwezig={afwezigOp(paneel.mw.id, dagen[paneel.dag]) ?? null}
          opdrachtgevers={p.opdrachtgevers}
          onSluit={() => setPaneel(null)}
          onOpslaan={(s, og, n) => slaVakOp(paneel.mw, dagen[paneel.dag], s, og, n)}
        />
      )}
      {paneel?.soort === "opmerking" && (
        <OpmerkingPaneel
          key={paneel.mw.id}
          mw={paneel.mw}
          week={p.week}
          tekst={opmerkingen.get(paneel.mw.id)?.tekst ?? ""}
          onSluit={() => setPaneel(null)}
          onOpslaan={(t) => slaOpmerkingOp(paneel.mw, t)}
        />
      )}
      {legenda && <Legenda onSluit={() => setLegenda(false)} />}
      {toast && <div className={`toast${toast.fout ? " fout" : ""}`} role="status">{toast.tekst}</div>}
    </main>
  );
}

function VakPaneel(props: {
  mw: Medewerker; datum: string; dagLabel: string; week: number; huidig: Vak | null; afwezig: Afwezigheid | null;
  opdrachtgevers: Opdrachtgever[]; onSluit: () => void; onOpslaan: (s: VakStatus | null, og: string | null, notitie: string) => void;
}) {
  const standaard: VakStatus = props.mw.groep === "kantoor" ? "kantoor" : "werk";
  const [status, setStatus] = useState<VakStatus>(props.huidig?.status ?? standaard);
  const [og, setOg] = useState<string>(props.huidig?.opdrachtgever_id ?? "");
  const [notitie, setNotitie] = useState(props.huidig?.notitie ?? "");
  const groepLabel = GROEPEN.find((g) => g.id === props.mw.groep)?.label ?? "";
  const kanOpslaan = status !== "werk" || !!og;

  return (
    <PaneelSchil
      boven={`Week ${props.week} · ${groepLabel}`}
      titel={props.mw.naam}
      sub={props.dagLabel.toLowerCase()}
      onSluit={props.onSluit}
      voet={<>
        {props.huidig && <button type="button" className="knop" onClick={() => props.onOpslaan(null, null, "")}>Leegmaken</button>}
        <div style={{ flexGrow: 1 }} />
        <button type="button" className="knop" onClick={props.onSluit}>Annuleren</button>
        <button type="button" className="knop knop-zwart" disabled={!kanOpslaan} onClick={() => props.onOpslaan(status, og || null, notitie)}>Opslaan</button>
      </>}
    >
      {props.afwezig && (
        <div className="melding" style={{ maxWidth: "none" }}>
          {props.mw.naam.split(" ")[0]} staat op {STATUS[props.afwezig.soort].label.toLowerCase()} van {props.afwezig.van} t/m {props.afwezig.tot_en_met}. Wat je hier invult, geldt alleen voor deze dag.
        </div>
      )}
      <div className="veld">
        <span>Status</span>
        <div className="statussen">
          {STATUS_VOLGORDE.map((s) => (
            <button key={s} type="button" className="status-keuze" aria-pressed={status === s} style={{ background: STATUS[s].bg, color: STATUS[s].fg }} onClick={() => setStatus(s)}>
              {STATUS[s].label}
            </button>
          ))}
        </div>
      </div>
      {status === "werk" && (
        <label className="veld">
          <span>Opdrachtgever</span>
          <select className="invoer" value={og} onChange={(e) => setOg(e.target.value)} required>
            <option value="">Kies een opdrachtgever</option>
            {props.opdrachtgevers.map((o) => <option key={o.id} value={o.id}>{o.naam}{o.plaats ? ` · ${o.plaats}` : ""}</option>)}
          </select>
          <span className="hint">Opdrachtgevers komen uit Easyflex2go.</span>
        </label>
      )}
      <label className="veld">
        <span>Notitie</span>
        <input className="invoer" value={notitie} onChange={(e) => setNotitie(e.target.value)} placeholder="Bijvoorbeeld start 06:00 of Rade · nacht" maxLength={80} />
      </label>
    </PaneelSchil>
  );
}

function OpmerkingPaneel(props: { mw: Medewerker; week: number; tekst: string; onSluit: () => void; onOpslaan: (t: string) => void }) {
  const [tekst, setTekst] = useState(props.tekst);
  return (
    <PaneelSchil
      boven={`Week ${props.week}`}
      titel={props.mw.naam}
      sub="opmerking bij deze week"
      onSluit={props.onSluit}
      voet={<>
        <button type="button" className="knop" onClick={props.onSluit}>Annuleren</button>
        <button type="button" className="knop knop-zwart" onClick={() => props.onOpslaan(tekst)}>Opslaan</button>
      </>}
    >
      <label className="veld">
        <span>Opmerking</span>
        <textarea className="invoer" value={tekst} onChange={(e) => setTekst(e.target.value)} maxLength={200} autoFocus placeholder="Bijvoorbeeld: wil zaterdag extra" />
        <span className="hint">Alleen zichtbaar in de planning van week {props.week}. Leeg laten om te verwijderen.</span>
      </label>
    </PaneelSchil>
  );
}

function Legenda({ onSluit }: { onSluit: () => void }) {
  return (
    <>
      <div className="paneel-achter" style={{ inset: 0 }} onClick={onSluit} />
      <div role="dialog" aria-label="Legenda" className="menu" style={{ position: "fixed", top: "50%", left: "50%", right: "auto", transform: "translate(-50%, -50%)", width: 440, padding: 20, gap: 12 }} onKeyDown={(e) => { if (e.key === "Escape") onSluit(); }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="machina" style={{ margin: 0, fontSize: 22 }}>Legenda</h2>
          <button type="button" className="icoonknop" onClick={onSluit} aria-label="Sluiten" autoFocus>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="statussen">
          {STATUS_VOLGORDE.map((s) => <span key={s} className="status-keuze" style={{ background: STATUS[s].bg, color: STATUS[s].fg, display: "flex", alignItems: "center" }}>{STATUS[s].label}</span>)}
          <span className="status-keuze vak leeg-open" style={{ display: "flex", alignItems: "center", minHeight: 40 }}>Open (nog niet gepland)</span>
        </div>
        <p style={{ margin: 0, fontSize: 13 }}><em>Schuin</em> = afwezigheid voor een langere periode.</p>
      </div>
    </>
  );
}
