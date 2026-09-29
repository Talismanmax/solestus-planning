"use client";

import { useMemo, useState } from "react";
import Icoon from "@/components/Icoon";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import { createClient } from "@/lib/supabase/client";
import { GROEPEN, geldigeVasteInzet, opdrachtgeverLabel, vasteInzetLabel, type VasteInzet } from "@/lib/planning";

export type MwStam = {
  id: string; naam: string; groep: string; bv: string | null; werkmaatschappijen: string[]; nationaliteit: string | null;
  certificaten: string[]; bron: string; ef_registratienummer: string | null; ef_id?: number | null; ef_status?: string | null; telefoon: string | null; actief: boolean; vaste_inzet: unknown;
};
type Og = { id: string; naam: string; korte_naam: string | null; plaats: string | null; verborgen?: boolean };

const DAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** Keuze in de lijst: "", "kantoor", "thuiswerk" of "og:<id>". */
const keuzeVan = (v: VasteInzet | null) => (!v ? "" : v.status === "werk" ? `og:${v.opdrachtgever_id}` : v.status);

/** Medewerker bewerken. Velden uit Easyflex2go zijn alleen-lezen; telefoon en vaste inzet horen bij de planning. */
export default function MedewerkerPaneel({ mw, opdrachtgevers, bvs, onSluit, onKlaar }: {
  mw: MwStam; opdrachtgevers: Og[]; bvs: string[];
  onSluit: () => void; onKlaar: (melding: string, fout?: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const ef = mw.bron === "easyflex";
  const huidig = geldigeVasteInzet(mw.vaste_inzet);
  const [naam, setNaam] = useState(mw.naam);
  const [bv, setBv] = useState(mw.bv ?? bvs[0]);
  const [telefoon, setTelefoon] = useState(mw.telefoon ?? "");
  const [certificaten, setCertificaten] = useState(mw.certificaten.join(", "));
  const [actief, setActief] = useState(mw.actief);
  const [keuze, setKeuze] = useState(keuzeVan(huidig));
  const [dagen, setDagen] = useState<number[]>(huidig?.dagen ?? [0, 1, 2, 3, 4]);
  const [bezig, setBezig] = useState(false);

  const vasteInzet: VasteInzet | null = !keuze || !dagen.length ? null
    : keuze.startsWith("og:") ? { status: "werk", opdrachtgever_id: keuze.slice(3), dagen: [...dagen].sort((a, b) => a - b) }
    : { status: keuze as "kantoor" | "thuiswerk", opdrachtgever_id: null, dagen: [...dagen].sort((a, b) => a - b) };
  const ogMap = useMemo(() => new Map(opdrachtgevers.map((o) => [o.id, o])), [opdrachtgevers]);
  const groepLabel = GROEPEN.find((g) => g.id === mw.groep)?.label ?? mw.groep;

  async function opslaan() {
    if (!ef && !naam.trim()) { onKlaar("Vul een naam in.", true); return; }
    setBezig(true);
    const wijziging: Record<string, unknown> = { telefoon: telefoon.trim() || null, vaste_inzet: vasteInzet };
    if (!ef) Object.assign(wijziging, {
      naam: naam.trim(), bv, actief,
      certificaten: certificaten.split(",").map((c) => c.trim()).filter(Boolean),
    });
    const { error } = await supabase.from("medewerkers").update(wijziging).eq("id", mw.id);
    setBezig(false);
    if (error) { onKlaar("Opslaan is niet gelukt: " + error.message, true); return; }
    const oud = vasteInzetLabel(mw.vaste_inzet, ogMap), nieuw = vasteInzetLabel(vasteInzet, ogMap);
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from("wijzigingen").insert({
      gebruiker_id: data.user.id, tabel: "medewerkers", record_id: mw.id,
      omschrijving: `${ef ? mw.naam : naam.trim()}: gegevens bijgewerkt${oud !== nieuw ? ` (vaste inzet: ${nieuw.toLowerCase()})` : ""}`,
    });
    onKlaar("Opgeslagen");
  }

  return (
    <PaneelSchil
      boven="Stamgegevens"
      titel={mw.naam}
      sub={`${mw.groep === "kantoor" ? "kantoor" : "chauffeur"}${mw.bv ? ` · ${mw.bv}` : ""}`}
      onSluit={onSluit}
      voet={<PaneelVoet opslaan={opslaan} uit={bezig} onAnnuleren={onSluit} />}
    >
      {ef && (
        <p className="infoblok slot-melding">
          <Icoon naam="slot" />
          <span>Naam, nationaliteit, groep, BV, certificaten en status komen uit Easyflex2go. Pas ze daar aan; de planning neemt het automatisch over.</span>
        </p>
      )}
      <div className="veld"><label className="veld-kop" htmlFor="mw-naam">Naam</label><input id="mw-naam" className="invoer" value={naam} onChange={(e) => setNaam(e.target.value)} disabled={ef} /></div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="veld"><label className="veld-kop" htmlFor="mw-groep">Groep</label><input id="mw-groep" className="invoer" value={groepLabel} disabled /></div>
          <div className="veld"><label className="veld-kop" htmlFor="mw-nat">Nationaliteit</label><input id="mw-nat" className="invoer" value={mw.nationaliteit ?? "–"} disabled /></div>
        </div>
        {ef && <p className="hint" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: "17px" }}>Volgt uit de nationaliteit in Easyflex2go: NL is Chauffeurs NL, anders internationaal.</p>}
      </div>
      <div className="veld">
        <label className="veld-kop" htmlFor="mw-bv">BV / contract</label>
        {ef
          ? <input id="mw-bv" className="invoer" value={mw.werkmaatschappijen.length > 1 ? mw.werkmaatschappijen.join(", ") : mw.bv ?? "–"} disabled />
          : <select id="mw-bv" className="invoer" value={bv} onChange={(e) => setBv(e.target.value)}>{bvs.map((b) => <option key={b}>{b}</option>)}</select>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="veld"><label className="veld-kop" htmlFor="mw-cert">Certificaten</label><input id="mw-cert" className="invoer" value={certificaten} onChange={(e) => setCertificaten(e.target.value)} disabled={ef} placeholder="bijv. CE, Code 95" /></div>
        <div className="veld"><label className="veld-kop" htmlFor="mw-tel">Telefoon</label><input id="mw-tel" className="invoer" type="tel" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="06-…" /></div>
      </div>

      <fieldset className="vaste-inzet">
        <legend>Vaste inzet</legend>
        <select className="invoer" aria-label="Vaste inzet" value={keuze} onChange={(e) => setKeuze(e.target.value)}>
          <option value="">Geen vaste inzet</option>
          <option value="kantoor">Kantoor</option>
          <option value="thuiswerk">Thuiswerk</option>
          <optgroup label="Opdrachtgever">
            {opdrachtgevers.filter((o) => !o.verborgen || keuze === `og:${o.id}`).map((o) => <option key={o.id} value={`og:${o.id}`}>{opdrachtgeverLabel(o)}{o.plaats ? ` · ${o.plaats}` : ""}</option>)}
          </optgroup>
        </select>
        <div className="dagkeuze" role="group" aria-label="Dagen">
          {DAGEN.map((d, i) => (
            <button key={d} type="button" aria-pressed={dagen.includes(i)} disabled={!keuze}
              onClick={() => setDagen(dagen.includes(i) ? dagen.filter((x) => x !== i) : [...dagen, i])}>{d}</button>
          ))}
        </div>
        <span className="hint">Met Vaste inzet invullen in de planning komen deze dagen automatisch in lege vakken.</span>
      </fieldset>

      {ef ? (
        <>
          <fieldset className="ef-blok">
            <legend className="veld-kop" style={{ float: "left", width: "100%", padding: 0, display: "flex", gap: 8, alignItems: "center" }}>Easyflex2go <span className="bron-ef">leidend</span></legend>
            <div style={{ clear: "both", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="veld"><label className="veld-kop" style={{ fontSize: 12, fontWeight: 600 }} htmlFor="mw-regnr">Registratienummer</label><input id="mw-regnr" className="invoer" value={mw.ef_registratienummer ?? "–"} disabled /></div>
              <div className="veld"><label className="veld-kop" style={{ fontSize: 12, fontWeight: 600 }} htmlFor="mw-efid">EF2GO-id</label><input id="mw-efid" className="invoer" value={mw.ef_id ?? "–"} disabled /></div>
            </div>
            <span className="hint">Status in Easyflex2go: {mw.ef_status ?? (mw.actief ? "Actief" : "niet actief")}. Uitgeschreven in Easyflex2go betekent: niet meer zichtbaar in de planning.</span>
          </fieldset>
          <label className="vink" style={{ opacity: 0.55 }}><input type="checkbox" checked={mw.actief} disabled />Actief (zichtbaar in de planning)</label>
        </>
      ) : (
        <label className="vink"><input type="checkbox" checked={actief} onChange={(e) => setActief(e.target.checked)} />Actief (zichtbaar in de planning)</label>
      )}
    </PaneelSchil>
  );
}
