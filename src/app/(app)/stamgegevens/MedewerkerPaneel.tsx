"use client";

import { useMemo, useState } from "react";
import PaneelSchil from "@/components/PaneelSchil";
import { createClient } from "@/lib/supabase/client";
import { GROEPEN, geldigeVasteInzet, opdrachtgeverLabel, vasteInzetLabel, type VasteInzet } from "@/lib/planning";

export type MwStam = {
  id: string; naam: string; groep: string; bv: string | null; werkmaatschappijen: string[]; nationaliteit: string | null;
  certificaten: string[]; bron: string; ef_registratienummer: string | null; telefoon: string | null; actief: boolean; vaste_inzet: unknown;
};
type Og = { id: string; naam: string; korte_naam: string | null; plaats: string | null };

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
      sub={`${groepLabel}${mw.bv ? ` · ${mw.bv}` : ""}`}
      onSluit={onSluit}
      voet={<>
        <div style={{ flexGrow: 1 }} />
        <button type="button" className="knop" onClick={onSluit}>Annuleren</button>
        <button type="button" className="knop knop-zwart" disabled={bezig} onClick={opslaan}>Opslaan</button>
      </>}
    >
      {ef && (
        <div className="melding" style={{ maxWidth: "none" }}>
          Naam, nationaliteit, groep, BV, certificaten en status komen uit Easyflex2go. Pas ze daar aan; de planning neemt het automatisch over.
        </div>
      )}
      <label className="veld"><span>Naam</span><input className="invoer" value={naam} onChange={(e) => setNaam(e.target.value)} disabled={ef} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="veld"><span>Groep</span><input className="invoer" value={groepLabel} disabled /></label>
        <label className="veld"><span>Nationaliteit</span><input className="invoer" value={mw.nationaliteit ?? "–"} disabled /></label>
      </div>
      {ef && <span className="hint" style={{ marginTop: -10 }}>Groep volgt uit de nationaliteit in Easyflex2go: NL is Chauffeurs NL, anders internationaal.</span>}
      <label className="veld">
        <span>BV / contract</span>
        {ef
          ? <input className="invoer" value={mw.werkmaatschappijen.length > 1 ? mw.werkmaatschappijen.join(", ") : mw.bv ?? "–"} disabled />
          : <select className="invoer" value={bv} onChange={(e) => setBv(e.target.value)}>{bvs.map((b) => <option key={b}>{b}</option>)}</select>}
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="veld"><span>Certificaten</span><input className="invoer" value={certificaten} onChange={(e) => setCertificaten(e.target.value)} disabled={ef} placeholder="Bijv. CE, Code 95" /></label>
        <label className="veld"><span>Telefoon</span><input className="invoer" type="tel" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="06-…" /></label>
      </div>

      <fieldset className="vaste-inzet">
        <legend>Vaste inzet</legend>
        <select className="invoer" aria-label="Vaste inzet" value={keuze} onChange={(e) => setKeuze(e.target.value)}>
          <option value="">Geen vaste inzet</option>
          <option value="kantoor">Kantoor</option>
          <option value="thuiswerk">Thuiswerk</option>
          <optgroup label="Opdrachtgever">
            {opdrachtgevers.map((o) => <option key={o.id} value={`og:${o.id}`}>{opdrachtgeverLabel(o)}{o.plaats ? ` · ${o.plaats}` : ""}</option>)}
          </optgroup>
        </select>
        <div className="dagkeuze" role="group" aria-label="Dagen">
          {DAGEN.map((d, i) => (
            <button key={d} type="button" aria-pressed={dagen.includes(i)} disabled={!keuze}
              onClick={() => setDagen(dagen.includes(i) ? dagen.filter((x) => x !== i) : [...dagen, i])}>{d}</button>
          ))}
        </div>
        <span className="hint">Met “Vaste inzet” in de weekplanning komen deze dagen automatisch in lege vakken. Afwezigheid en wat al gepland is, blijven staan.</span>
      </fieldset>

      {ef ? (
        <div className="melding" style={{ maxWidth: "none" }}>
          <strong>Easyflex2go</strong>
          Registratienummer {mw.ef_registratienummer ?? "–"} · {mw.actief ? "actief" : "niet actief (niet zichtbaar in de planning)"}
        </div>
      ) : (
        <label className="vink"><input type="checkbox" checked={actief} onChange={(e) => setActief(e.target.checked)} />Actief (zichtbaar in de planning)</label>
      )}
    </PaneelSchil>
  );
}
