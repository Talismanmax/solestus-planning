"use client";

import { useEffect } from "react";
import Icoon from "./Icoon";

/**
 * Paneel rechts, zoals in het design: kleine kapitalen erboven, titel in PP Neue Machina,
 * ondertitel in Zilla Slab, gele lijn eronder. De voet volgt het patroon
 * Opslaan (zwart) · Annuleren (tekst) · ruimte · gevaarlijke actie (onderstreept).
 */
export default function PaneelSchil({ boven, titel, sub, onSluit, children, voet }: {
  boven: string; titel: string; sub: string; onSluit: () => void; children: React.ReactNode; voet: React.ReactNode;
}) {
  useEffect(() => {
    const toets = (e: KeyboardEvent) => { if (e.key === "Escape") onSluit(); };
    document.addEventListener("keydown", toets);
    return () => document.removeEventListener("keydown", toets);
  }, [onSluit]);
  return (
    <>
      <div className="paneel-achter" onClick={onSluit} />
      <aside className="paneel" role="dialog" aria-label={titel}>
        <div className="paneel-kop">
          <div>
            <span className="paneel-boven">{boven}</span>
            <h2 className="machina">{titel}</h2>
            <span className="paneel-sub">{sub}</span>
          </div>
          <button type="button" className="icoonknop" onClick={onSluit} aria-label="Sluiten"><Icoon naam="sluiten" maat={20} /></button>
        </div>
        <div className="paneel-inhoud">{children}</div>
        <div className="paneel-voet">{voet}</div>
      </aside>
    </>
  );
}

/** Standaardvoet: Opslaan, Annuleren en optioneel een onderstreepte actie rechts. */
export function PaneelVoet({ opslaan, opslaanLabel = "Opslaan", uit = false, onAnnuleren, annulerenLabel = "Annuleren", gevaar }: {
  opslaan?: () => void; opslaanLabel?: string; uit?: boolean; onAnnuleren: () => void; annulerenLabel?: string;
  gevaar?: { label: string; onClick: () => void; uit?: boolean };
}) {
  return (
    <>
      {opslaan && <button type="button" className="knop knop-zwart" disabled={uit} onClick={opslaan}>{opslaanLabel}</button>}
      <button type="button" className={`knop${opslaan ? " knop-tekst" : ""}`} onClick={onAnnuleren}>{annulerenLabel}</button>
      <span className="ruimte" />
      {gevaar && <button type="button" className="knop-link" disabled={gevaar.uit} onClick={gevaar.onClick}>{gevaar.label}</button>}
    </>
  );
}
