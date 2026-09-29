"use client";

import { useState } from "react";

/** Knop "Vaste inzet" met een bevestiging: vult alleen lege vakken. */
export default function VasteInzetKnop({ week, aantalVakken, aantalMedewerkers, onInvullen }: {
  week: number; aantalVakken: number; aantalMedewerkers: number; onInvullen: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);

  return (
    <div className="menu-anker">
      <button type="button" className="knop" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} disabled={bezig} title="Vult lege vakken met de vaste inzet van medewerkers">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4" /><path d="M3 11V9a2 2 0 0 1 2-2h16" /><path d="M7 21l-4-4 4-4" /><path d="M21 13v2a2 2 0 0 1-2 2H3" /></svg>
        {bezig ? "Bezig…" : "Vaste inzet"}
      </button>
      {open && (
        <>
          <div className="menu-sluiter" onClick={() => setOpen(false)} />
          <div className="menu kopieer-menu" role="dialog" aria-label="Vaste inzet invullen" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
            <h2>Vaste inzet invullen in week {week}</h2>
            <p>
              {aantalVakken === 0
                ? aantalMedewerkers === 0
                  ? "Nog geen medewerker heeft een vaste inzet. Die stel je in bij Stamgegevens."
                  : "Er zijn geen lege vakken om te vullen: alles met een vaste inzet is al gepland of afwezig."
                : `${aantalVakken} lege ${aantalVakken === 1 ? "vak wordt" : "vakken worden"} gevuld met de vaste inzet van ${aantalMedewerkers} ${aantalMedewerkers === 1 ? "medewerker" : "medewerkers"}. Wat al gepland is en afwezigheid blijven staan.`}
            </p>
            <div className="kopieer-knoppen">
              <button type="button" className="knop" onClick={() => setOpen(false)}>{aantalVakken ? "Annuleren" : "Sluiten"}</button>
              {aantalVakken > 0 && (
                <button type="button" className="knop knop-zwart" autoFocus onClick={async () => {
                  setOpen(false); setBezig(true);
                  try { await onInvullen(); } finally { setBezig(false); }
                }}>Invullen</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
