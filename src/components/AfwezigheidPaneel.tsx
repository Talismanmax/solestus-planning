"use client";

import { useMemo, useState } from "react";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import { createClient } from "@/lib/supabase/client";
import { logWijziging } from "@/lib/wijzigingen";
import { AFWEZIG_SOORTEN, STATUS, aantalDagen, periodeKort, type Afwezigheid, type VakStatus } from "@/lib/planning";

type Mw = { id: string; naam: string };

/** Afwezigheid voor een periode invoeren, wijzigen of verwijderen. Roept onKlaar aan met een melding na opslaan. */
export default function AfwezigheidPaneel(props: {
  medewerkers: Mw[]; bestaand: Afwezigheid | null; standaardVan: string; standaardMedewerker?: string;
  onAnders?: { label: string; onClick: () => void };
  onSluit: () => void; onKlaar: (melding: string, fout?: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const b = props.bestaand;
  const [mwId, setMwId] = useState(b?.medewerker_id ?? props.standaardMedewerker ?? "");
  const [soort, setSoort] = useState<VakStatus>(b?.soort ?? "vakantie");
  const [van, setVan] = useState(b?.van ?? props.standaardVan);
  const [tot, setTot] = useState(b?.tot_en_met ?? props.standaardVan);
  const [notitie, setNotitie] = useState(b?.notitie ?? "");
  const [bezig, setBezig] = useState(false);

  const naam = props.medewerkers.find((m) => m.id === mwId)?.naam ?? "Medewerker";
  const periodeKlopt = !!van && !!tot && van <= tot;
  const kanOpslaan = !!mwId && periodeKlopt && !bezig;

  const log = (omschrijving: string, recordId: string) => logWijziging(supabase, "afwezigheid", omschrijving, recordId);

  async function opslaan() {
    setBezig(true);
    const { data: auth } = await supabase.auth.getUser();
    const rij = { medewerker_id: mwId, soort, van, tot_en_met: tot, notitie: notitie.trim() || null, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() };
    const q = b
      ? supabase.from("afwezigheid").update(rij).eq("id", b.id).select("id").single()
      : supabase.from("afwezigheid").insert(rij).select("id").single();
    const { data, error } = await q;
    setBezig(false);
    if (error || !data) { props.onKlaar("Opslaan is niet gelukt. De afwezigheid is niet bewaard.", true); return; }
    await log(`${naam}: ${STATUS[soort].label.toLowerCase()} ${periodeKort(van, tot)}${rij.notitie ? ` (${rij.notitie})` : ""}`, data.id);
    props.onKlaar("Afwezigheid opgeslagen");
  }

  async function verwijderen() {
    if (!b) return;
    setBezig(true);
    const { error } = await supabase.from("afwezigheid").delete().eq("id", b.id);
    setBezig(false);
    if (error) { props.onKlaar("Verwijderen is niet gelukt.", true); return; }
    await log(`${naam}: ${STATUS[b.soort].label.toLowerCase()} ${periodeKort(b.van, b.tot_en_met)} verwijderd`, b.id);
    props.onKlaar("Afwezigheid verwijderd");
  }

  return (
    <PaneelSchil
      boven="Afwezigheid"
      titel={mwId ? naam : "Afwezigheid invoeren"}
      sub={periodeKlopt ? `${periodeKort(van, tot)}${van !== tot ? ` · ${aantalDagen(van, tot)} dagen` : ""}` : "voor één of meer dagen"}
      onSluit={props.onSluit}
      voet={<PaneelVoet opslaan={opslaan} uit={!kanOpslaan} onAnnuleren={props.onSluit} gevaar={b ? { label: "Verwijderen", onClick: verwijderen, uit: bezig } : undefined} />}
    >
      {!b && !props.standaardMedewerker && (
        <label className="veld">
          <span>Medewerker</span>
          <select className="invoer" value={mwId} onChange={(e) => setMwId(e.target.value)} autoFocus>
            <option value="">Kies een medewerker</option>
            {props.medewerkers.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}
          </select>
        </label>
      )}
      <fieldset className="veld">
        <legend>Soort</legend>
        <div className="pillen">
          {AFWEZIG_SOORTEN.map((s) => (
            <button key={s} type="button" className="pil" aria-pressed={soort === s} style={{ background: STATUS[s].bg, color: STATUS[s].fg }} onClick={() => setSoort(s)}>
              {STATUS[s].label}
            </button>
          ))}
        </div>
      </fieldset>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="veld">
          <span>Van</span>
          <input className="invoer" type="date" value={van} onChange={(e) => { setVan(e.target.value); if (e.target.value > tot) setTot(e.target.value); }} />
        </label>
        <label className="veld">
          <span>Tot en met</span>
          <input className="invoer" type="date" value={tot} min={van} onChange={(e) => setTot(e.target.value)} />
        </label>
      </div>
      {!periodeKlopt && <div className="melding melding-fout" style={{ maxWidth: "none" }}>De einddatum ligt vóór de begindatum.</div>}
      <label className="veld">
        <span>Notitie</span>
        <input className="invoer" value={notitie} onChange={(e) => setNotitie(e.target.value)} placeholder="bijv. zomervakantie, bruiloft" maxLength={80} />
      </label>
      <p className="infoblok">
        De periode vult de planning automatisch, ook in weken die nog komen. Staat er op een dag al iets anders ingepland, dan blijft dat staan en krijgt het vak een uitroepteken.
      </p>
      {props.onAnders && <button type="button" className="link-knop" onClick={props.onAnders.onClick}>{props.onAnders.label}</button>}
    </PaneelSchil>
  );
}
