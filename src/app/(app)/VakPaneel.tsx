"use client";

import { useState } from "react";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import { STATUS, STATUS_VOLGORDE, opdrachtgeverLabel, type Opdrachtgever, type VakStatus } from "@/lib/planning";

export type Invulling = { status: VakStatus; opdrachtgeverId: string | null; notitie: string };

const DAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/**
 * Vak bewerken (één vak, met "Toepassen op" voor meer dagen van dezelfde medewerker)
 * of meerdere geselecteerde vakken tegelijk (zonder dagkeuze).
 */
export default function VakPaneel(p: {
  boven: string; titel: string; sub: string; standaard: VakStatus; huidig: Invulling | null; afwezigTekst: string | null;
  opdrachtgevers: Opdrachtgever[]; dagIndex?: number;
  onSluit: () => void; onOpslaan: (w: Invulling | null, dagen: number[]) => void; onAfwezigheid?: () => void;
}) {
  const [status, setStatus] = useState<VakStatus>(p.huidig?.status ?? p.standaard);
  const [og, setOg] = useState<string>(p.huidig?.opdrachtgeverId ?? "");
  const [notitie, setNotitie] = useState(p.huidig?.notitie ?? "");
  const [zoek, setZoek] = useState("");
  const [dagen, setDagen] = useState<number[]>(p.dagIndex !== undefined ? [p.dagIndex] : []);
  const kanOpslaan = (status !== "werk" || !!og) && (p.dagIndex === undefined || dagen.length > 0);

  const q = zoek.trim().toLowerCase();
  const lijst = p.opdrachtgevers
    .filter((o) => (!o.verborgen || o.id === og) && (!q || o.naam.toLowerCase().includes(q) || (o.korte_naam ?? "").toLowerCase().includes(q) || (o.plaats ?? "").toLowerCase().includes(q)))
    .sort((a, b) => (b.id === og ? 1 : 0) - (a.id === og ? 1 : 0));
  const zichtbaar = q ? lijst.slice(0, 30) : lijst.slice(0, 8);

  const wissel = (i: number) => setDagen(dagen.includes(i) ? dagen.filter((d) => d !== i) : [...dagen, i].sort());

  return (
    <PaneelSchil
      boven={p.boven}
      titel={p.titel}
      sub={p.sub}
      onSluit={p.onSluit}
      voet={<PaneelVoet
        opslaan={() => p.onOpslaan({ status, opdrachtgeverId: status === "werk" ? og || null : null, notitie }, dagen)}
        uit={!kanOpslaan}
        onAnnuleren={p.onSluit}
        gevaar={p.huidig || p.dagIndex === undefined ? { label: "Leegmaken", onClick: () => p.onOpslaan(null, dagen) } : undefined}
      />}
    >
      {p.afwezigTekst && <p className="infoblok">{p.afwezigTekst}</p>}
      <fieldset className="veld">
        <legend>Status</legend>
        <div className="pillen">
          {STATUS_VOLGORDE.map((s) => (
            <button key={s} type="button" className="pil" aria-pressed={status === s} style={{ background: STATUS[s].bg, color: STATUS[s].fg }} onClick={() => setStatus(s)}>
              {STATUS[s].label}
            </button>
          ))}
        </div>
      </fieldset>
      {status === "werk" && (
        <div className="veld">
          <label className="veld-kop" htmlFor="vak-og">Opdrachtgever</label>
          <input id="vak-og" className="invoer" type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek opdrachtgever" autoComplete="off" />
          <div className="keuzelijst" role="group" aria-label="Opdrachtgevers">
            {zichtbaar.map((o) => (
              <button key={o.id} type="button" aria-pressed={og === o.id} onClick={() => setOg(o.id)}>
                <span>{opdrachtgeverLabel(o)}</span><small>{o.plaats ?? ""}</small>
              </button>
            ))}
            {zichtbaar.length === 0 && <span className="keuzelijst-leeg">Geen opdrachtgever gevonden.</span>}
            {!q && lijst.length > zichtbaar.length && <span className="keuzelijst-leeg">Nog {lijst.length - zichtbaar.length} andere; zoek om ze te vinden.</span>}
          </div>
        </div>
      )}
      <div className="veld">
        <label className="veld-kop" htmlFor="vak-notitie">Notitie</label>
        <input id="vak-notitie" className="invoer" value={notitie} onChange={(e) => setNotitie(e.target.value)} placeholder="bijv. start 06:00, na 13:00 uur, buitenland" maxLength={80} />
      </div>
      {p.dagIndex !== undefined && (
        <fieldset className="veld">
          <legend>Toepassen op</legend>
          <div className="dagkeuze">
            {DAGEN.map((d, i) => <button key={d} type="button" aria-pressed={dagen.includes(i)} onClick={() => wissel(i)}>{d}</button>)}
            <button type="button" className="knop-link" onClick={() => setDagen([0, 1, 2, 3, 4])}>ma–vr</button>
          </div>
        </fieldset>
      )}
      {p.onAfwezigheid && <button type="button" className="link-knop" onClick={p.onAfwezigheid}>Afwezigheid voor een langere periode invoeren</button>}
    </PaneelSchil>
  );
}
