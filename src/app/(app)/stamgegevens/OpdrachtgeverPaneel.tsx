"use client";

import { useEffect, useMemo, useState } from "react";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import { createClient } from "@/lib/supabase/client";
import { logWijziging } from "@/lib/wijzigingen";
import { isoWeek, maandagVan, opdrachtgeverLabel, plusDagen, vandaagNL } from "@/lib/planning";

export type OgStam = {
  id: string; naam: string; plaats: string | null; korte_naam: string | null; verborgen: boolean; scania: boolean;
};

/** Opdrachtgever toevoegen (og = null) of bewerken. Opdrachtgevers beheren planners zelf; ze komen niet uit Easyflex2go. */
export default function OpdrachtgeverPaneel({ og, anderScania, onSluit, onKlaar }: {
  og: OgStam | null; anderScania: string | null; onSluit: () => void; onKlaar: (melding: string, fout?: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [naam, setNaam] = useState(og?.naam ?? "");
  const [plaats, setPlaats] = useState(og?.plaats ?? "");
  const [korteNaam, setKorteNaam] = useState(og?.korte_naam ?? "");
  const [kiesbaar, setKiesbaar] = useState(!og?.verborgen);
  const [scania, setScania] = useState(og?.scania ?? false);
  const [bezig, setBezig] = useState(false);
  const [inzet, setInzet] = useState<{ diensten: number; namen: string[]; ooit: number } | null>(null);

  const week = isoWeek(vandaagNL());
  useEffect(() => {
    if (!og) return;
    const ma = maandagVan(week.jaar, week.week);
    Promise.all([
      supabase.from("vakken").select("medewerkers(naam)").eq("opdrachtgever_id", og.id).gte("datum", ma).lte("datum", plusDagen(ma, 6)),
      supabase.from("vakken").select("id", { count: "exact", head: true }).eq("opdrachtgever_id", og.id),
    ]).then(([deze, alle]) => {
      if (deze.error) { setInzet({ diensten: -1, namen: [], ooit: alle.count ?? 0 }); return; }
      const rijen = (deze.data ?? []) as unknown as { medewerkers: { naam: string } | null }[];
      setInzet({ diensten: rijen.length, namen: [...new Set(rijen.map((r) => r.medewerkers?.naam).filter((n): n is string => !!n))], ooit: alle.count ?? 0 });
    });
  }, [supabase, og, week.jaar, week.week]);

  const log = (omschrijving: string, id?: string) => logWijziging(supabase, "opdrachtgevers", omschrijving, id);

  async function opslaan() {
    const n = naam.trim();
    if (!n) { onKlaar("Vul een naam in.", true); return; }
    setBezig(true);
    // Er is maar één Scania-opdrachtgever: het vinkje eerst bij de andere weghalen.
    if (scania && !og?.scania && anderScania) await supabase.from("opdrachtgevers").update({ scania: false }).eq("scania", true);
    const rij = { naam: n, plaats: plaats.trim() || null, korte_naam: korteNaam.trim() || null, verborgen: !kiesbaar, scania };
    const { data, error } = og
      ? await supabase.from("opdrachtgevers").update(rij).eq("id", og.id).select("id").single()
      : await supabase.from("opdrachtgevers").insert(rij).select("id").single();
    setBezig(false);
    if (error) { onKlaar("Opslaan is niet gelukt: " + error.message, true); return; }
    if (!og) {
      await log(`Opdrachtgever toegevoegd: ${n}${plaats.trim() ? ` (${plaats.trim()})` : ""}`, data?.id);
      onKlaar("Opdrachtgever toegevoegd");
      return;
    }
    const delen = [
      n !== og.naam ? `naam "${n}"` : null,
      (plaats.trim() || null) !== og.plaats ? `plaats "${plaats.trim() || "–"}"` : null,
      (korteNaam.trim() || null) !== og.korte_naam ? (korteNaam.trim() ? `korte naam "${korteNaam.trim()}"` : "korte naam verwijderd") : null,
      !kiesbaar !== og.verborgen ? (kiesbaar ? "weer kiesbaar in de planning" : "verborgen in de planning") : null,
      scania !== og.scania ? (scania ? "is nu de Scania-opdrachtgever" : "niet meer de Scania-opdrachtgever") : null,
    ].filter(Boolean);
    if (delen.length) await log(`${og.naam}: ${delen.join(", ")}`, og.id);
    onKlaar("Opgeslagen");
  }

  async function verwijderen() {
    if (!og || !confirm(`${og.naam} verwijderen?`)) return;
    setBezig(true);
    const { error } = await supabase.from("opdrachtgevers").delete().eq("id", og.id);
    setBezig(false);
    if (error) {
      onKlaar(error.code === "23503" ? "Deze opdrachtgever staat nog in de planning. Zet ‘Kiesbaar in de planning’ uit om hem te verbergen." : "Verwijderen is niet gelukt: " + error.message, true);
      return;
    }
    await log(`Opdrachtgever verwijderd: ${og.naam}`);
    onKlaar("Opdrachtgever verwijderd");
  }

  const voorbeeld = opdrachtgeverLabel({ naam: naam.trim() || "…", korte_naam: korteNaam.trim() || null });
  // Verwijderen kan alleen als hij nergens in de planning staat; anders verbergen.
  const magWeg = og && inzet !== null && inzet.ooit === 0;

  return (
    <PaneelSchil
      boven="Stamgegevens"
      titel={og ? opdrachtgeverLabel(og) : "Opdrachtgever toevoegen"}
      sub={og ? "opdrachtgever" : "nieuwe opdrachtgever"}
      onSluit={onSluit}
      voet={<PaneelVoet opslaan={opslaan} opslaanLabel={og ? "Opslaan" : "Toevoegen"} uit={bezig || !naam.trim()} onAnnuleren={onSluit}
        gevaar={magWeg ? { label: "Verwijderen", onClick: verwijderen, uit: bezig } : undefined} />}
    >
      <label className="veld"><span>Naam</span><input className="invoer" value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={80} placeholder="bijv. Pultrum Rijssen B.V." autoFocus={!og} /></label>
      <label className="veld"><span>Plaats</span><input className="invoer" value={plaats} onChange={(e) => setPlaats(e.target.value)} maxLength={40} placeholder="bijv. Rijssen" /></label>
      <label className="veld">
        <span>Korte naam in het rooster</span>
        <input className="invoer" value={korteNaam} onChange={(e) => setKorteNaam(e.target.value)} maxLength={24} placeholder="optioneel" />
        <span className="hint">Alleen voor de planning, zodat de naam in een vak past. In het rooster: <strong>{voorbeeld}</strong></span>
      </label>
      {og && (
        <div className="melding" style={{ maxWidth: "none" }}>
          <strong>In week {week.week}</strong>
          {inzet === null ? "laden…" : inzet.diensten < 0 ? "Kon de inzet niet laden." : inzet.diensten === 0 ? "Nog niemand ingezet." : `${inzet.diensten} ${inzet.diensten === 1 ? "dienst" : "diensten"} · ${inzet.namen.join(", ")}`}
        </div>
      )}
      <label className="vink">
        <input type="checkbox" checked={kiesbaar} onChange={(e) => setKiesbaar(e.target.checked)} />
        Kiesbaar in de planning
      </label>
      <span className="hint" style={{ marginTop: -10 }}>
        Zet dit uit voor een opdrachtgever waar je niet meer voor werkt. Wat al ingepland is, blijft staan.
        {og && inzet !== null && inzet.ooit > 0 && ` Verwijderen kan niet: hij staat ${inzet.ooit === 1 ? "één keer" : `${inzet.ooit} keer`} in de planning.`}
      </span>
      <label className="vink">
        <input type="checkbox" checked={scania} onChange={(e) => setScania(e.target.checked)} />
        Scania-opdrachtgever
      </label>
      <span className="hint" style={{ marginTop: -10 }}>
        Chauffeurs van de Scania-ritten komen in de weekplanning op deze opdrachtgever.
        {scania && !og?.scania && anderScania && ` Nu is dat ${anderScania}; die verliest het vinkje.`}
      </span>
    </PaneelSchil>
  );
}
