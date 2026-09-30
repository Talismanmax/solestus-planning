"use client";

import { useState } from "react";
import Icoon from "@/components/Icoon";

/** Popover "Vorige week kopiëren" met de twee keuzes uit het design. Open/dicht wordt van buitenaf bestuurd. */
export default function WeekKopieren({ week, vorigeWeek, ingevuld, open, setOpen, onKopieer }: {
  week: number; vorigeWeek: number; ingevuld: number; open: boolean; setOpen: (o: boolean) => void;
  onKopieer: (zonderAfwezigheid: boolean, metOpmerkingen: boolean) => Promise<void>;
}) {
  const [zonderAfwezigheid, setZonderAfwezigheid] = useState(true);
  const [metOpmerkingen, setMetOpmerkingen] = useState(false);
  const [bezig, setBezig] = useState(false);

  return (
    <div className="menu-anker">
      <button type="button" className="knop" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} disabled={bezig}
        style={open ? { boxShadow: "0 0 0 3px var(--geel)" } : undefined}>
        <Icoon naam="kopie" />
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
              <button type="button" className="knop knop-tekst" onClick={() => setOpen(false)}>Annuleren</button>
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
