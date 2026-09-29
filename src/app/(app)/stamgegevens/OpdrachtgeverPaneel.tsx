"use client";

import { useEffect, useMemo, useState } from "react";
import Icoon from "@/components/Icoon";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import { createClient } from "@/lib/supabase/client";
import { isoWeek, maandagVan, opdrachtgeverLabel, plusDagen, vandaagNL } from "@/lib/planning";

export type OgStam = {
  id: string; naam: string; plaats: string | null; korte_naam: string | null; actief: boolean; verborgen: boolean;
  werkmaatschappijen: string[]; kvk_nummer: number | null; ef_relatie_id: number | null; ef_status: string | null;
};

/** Opdrachtgever bewerken: korte naam en zichtbaarheid horen bij de planning, de rest komt uit Easyflex2go. */
export default function OpdrachtgeverPaneel({ og, onSluit, onKlaar }: {
  og: OgStam; onSluit: () => void; onKlaar: (melding: string, fout?: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [korteNaam, setKorteNaam] = useState(og.korte_naam ?? "");
  const [kiesbaar, setKiesbaar] = useState(!og.verborgen);
  const [bezig, setBezig] = useState(false);
  const [inzet, setInzet] = useState<{ diensten: number; namen: string[] } | null>(null);

  const week = isoWeek(vandaagNL());
  useEffect(() => {
    const ma = maandagVan(week.jaar, week.week);
    supabase.from("vakken").select("medewerkers(naam)").eq("opdrachtgever_id", og.id).gte("datum", ma).lte("datum", plusDagen(ma, 6))
      .then(({ data, error }) => {
        if (error) { setInzet({ diensten: -1, namen: [] }); return; }
        const rijen = (data ?? []) as unknown as { medewerkers: { naam: string } | null }[];
        setInzet({ diensten: rijen.length, namen: [...new Set(rijen.map((r) => r.medewerkers?.naam).filter((n): n is string => !!n))] });
      });
  }, [supabase, og.id, week.jaar, week.week]);

  async function opslaan() {
    setBezig(true);
    const kort = korteNaam.trim() || null;
    const { error } = await supabase.from("opdrachtgevers").update({ korte_naam: kort, verborgen: !kiesbaar }).eq("id", og.id);
    setBezig(false);
    if (error) { onKlaar("Opslaan is niet gelukt: " + error.message, true); return; }
    const delen = [
      kort !== og.korte_naam ? (kort ? `korte naam "${kort}"` : "korte naam verwijderd") : null,
      !kiesbaar !== og.verborgen ? (kiesbaar ? "weer kiesbaar in de planning" : "verborgen in de planning") : null,
    ].filter(Boolean);
    if (delen.length) {
      const { data } = await supabase.auth.getUser();
      if (data.user) await supabase.from("wijzigingen").insert({ gebruiker_id: data.user.id, tabel: "opdrachtgevers", record_id: og.id, omschrijving: `${og.naam}: ${delen.join(", ")}` });
    }
    onKlaar("Opgeslagen");
  }

  const voorbeeld = opdrachtgeverLabel({ naam: og.naam, korte_naam: korteNaam.trim() || null });

  return (
    <PaneelSchil
      boven="Stamgegevens"
      titel={opdrachtgeverLabel(og)}
      sub="opdrachtgever"
      onSluit={onSluit}
      voet={<PaneelVoet opslaan={opslaan} uit={bezig} onAnnuleren={onSluit} />}
    >
      {og.ef_relatie_id !== null && (
        <p className="infoblok slot-melding">
          <Icoon naam="slot" />
          <span>Naam, plaats, relatie-id en status komen uit Easyflex2go. Pas ze daar aan; de planning neemt het automatisch over.</span>
        </p>
      )}
      <label className="veld"><span>Naam in Easyflex2go</span><input className="invoer" value={og.naam} disabled /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="veld"><span>Plaats</span><input className="invoer" value={og.plaats ?? "–"} disabled /></label>
        <label className="veld"><span>EF2GO relatie-id</span><input className="invoer" value={og.ef_relatie_id ?? "–"} disabled /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="veld"><span>Status in Easyflex2go</span><input className="invoer" value={og.ef_status ?? "–"} disabled /></label>
        <label className="veld"><span>KvK-nummer</span><input className="invoer" value={og.kvk_nummer ?? "–"} disabled /></label>
      </div>
      {og.werkmaatschappijen.length > 0 && (
        <label className="veld"><span>Werkmaatschappijen</span><input className="invoer" value={og.werkmaatschappijen.join(", ")} disabled /></label>
      )}
      <label className="veld">
        <span>Korte naam in het rooster</span>
        <input className="invoer" value={korteNaam} onChange={(e) => setKorteNaam(e.target.value)} maxLength={24} placeholder={opdrachtgeverLabel({ naam: og.naam, korte_naam: null })} autoFocus />
        <span className="hint">Alleen voor de planning, zodat de naam in een vak past. In het rooster: <strong>{voorbeeld}</strong></span>
      </label>
      <div className="melding" style={{ maxWidth: "none" }}>
        <strong>In week {week.week}</strong>
        {inzet === null ? "laden…" : inzet.diensten < 0 ? "Kon de inzet niet laden." : inzet.diensten === 0 ? "Nog niemand ingezet." : `${inzet.diensten} ${inzet.diensten === 1 ? "dienst" : "diensten"} · ${inzet.namen.join(", ")}`}
      </div>
      <label className="vink">
        <input type="checkbox" checked={kiesbaar} onChange={(e) => setKiesbaar(e.target.checked)} />
        Kiesbaar in de planning
      </label>
      <span className="hint" style={{ marginTop: -10 }}>
        Relaties die in Easyflex2go niet op Actief staan, zijn automatisch niet kiesbaar; verandert de status daar, dan past de planning dit aan.
        Zet dit zelf uit voor interne relaties of testrelaties. Wat al ingepland is, blijft staan.
        {!og.actief && " Deze relatie staat niet (meer) in Easyflex2go en is daarom sowieso niet kiesbaar."}
      </span>
    </PaneelSchil>
  );
}
