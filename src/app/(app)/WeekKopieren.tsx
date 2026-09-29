"use client";

import { useState } from "react";

/** Popover "Vorige week kopiëren" met de twee keuzes uit het design. */
export default function WeekKopieren({ week, vorigeWeek, ingevuld, onKopieer }: {
  week: number; vorigeWeek: number; ingevuld: number;
  onKopieer: (zonderAfwezigheid: boolean, metOpmerkingen: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [zonderAfwezigheid, setZonderAfwezigheid] = useState(true);
  const [metOpmerkingen, setMetOpmerkingen] = useState(false);
  const [bezig, setBezig] = useState(false);

  return (
    <div className="menu-anker">
      <button type="button" className="knop" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} disabled={bezig}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
        {bezig ? "Bezig met kopiëren…" : "Vorige week kopiëren"}
      </button>
      {open && (
        <>
          <div className="menu-sluiter" onClick={() => setOpen(false)} />
          <div className="menu kopieer-menu" role="dialog" aria-label={`Week ${vorigeWeek} kopiëren naar week ${week}`} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
            <h2>Week {vorigeWeek} kopiëren naar week {week}</h2>
            <p>
              {ingevuld === 0
                ? `Week ${week} is nog leeg. Alles uit week ${vorigeWeek} komt erin; afwezigheid uit periodes blijft gewoon staan.`
                : `Let op: week ${week} heeft al ${ingevuld} ingevulde ${ingevuld === 1 ? "vak" : "vakken"}. Vakken die in week ${vorigeWeek} ook zijn ingevuld, worden overschreven.`}
            </p>
            <label className="vink"><input type="checkbox" checked={zonderAfwezigheid} onChange={(e) => setZonderAfwezigheid(e.target.checked)} />Afwezigheid niet meenemen (vakantie, ziek, vrij, einde)</label>
            <label className="vink"><input type="checkbox" checked={metOpmerkingen} onChange={(e) => setMetOpmerkingen(e.target.checked)} />Opmerkingen ook kopiëren</label>
            <div className="kopieer-knoppen">
              <button type="button" className="knop" onClick={() => setOpen(false)}>Annuleren</button>
              <button type="button" className="knop knop-zwart" autoFocus onClick={async () => {
                setOpen(false); setBezig(true);
                try { await onKopieer(zonderAfwezigheid, metOpmerkingen); } finally { setBezig(false); }
              }}>{ingevuld === 0 ? "Kopiëren" : "Overschrijven"}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
