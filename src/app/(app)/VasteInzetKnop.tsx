"use client";

import { useState } from "react";
import Icoon from "@/components/Icoon";

/** Knop "Vaste inzet" met een bevestiging: vult alleen lege vakken. Open/dicht wordt van buitenaf bestuurd. */
export default function VasteInzetKnop({ week, aantalVakken, aantalMedewerkers, open, setOpen, onInvullen }: {
  week: number; aantalVakken: number; aantalMedewerkers: number; open: boolean; setOpen: (o: boolean) => void; onInvullen: () => Promise<void>;
}) {
  const [bezig, setBezig] = useState(false);

  return (
    <div className="menu-anker">
      <button type="button" className="knop" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} disabled={bezig}
        title="Vult lege vakken met de vaste inzet van medewerkers" style={open ? { boxShadow: "0 0 0 3px var(--geel)" } : undefined}>
        <Icoon naam="wissel" />
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
              <button type="button" className="knop knop-tekst" onClick={() => setOpen(false)}>{aantalVakken ? "Annuleren" : "Sluiten"}</button>
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
