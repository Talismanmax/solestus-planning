"use client";

import { useCallback, useRef, useState } from "react";
import Icoon from "./Icoon";

type Melding = { tekst: string; fout?: boolean; opnieuw?: () => void };

/** Korte melding onderin het scherm. `toon(tekst, fout?, opnieuw?)`; met `opnieuw` komt er een knop "Opnieuw proberen". */
export function useToast() {
  const [melding, setMelding] = useState<Melding | null>(null);
  const klok = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toon = useCallback((tekst: string, fout = false, opnieuw?: () => void) => {
    clearTimeout(klok.current);
    setMelding({ tekst, fout, opnieuw });
    klok.current = setTimeout(() => setMelding(null), opnieuw ? 12000 : fout ? 6000 : 2500);
  }, []);
  const sluit = useCallback(() => { clearTimeout(klok.current); setMelding(null); }, []);
  return { melding, toon, sluit };
}

export default function Toast({ melding, sluit }: { melding: Melding | null; sluit: () => void }) {
  if (!melding) return null;
  return (
    <div className={`toast${melding.opnieuw ? " met-knop" : ""}`} role={melding.fout ? "alert" : "status"}>
      {melding.fout && <Icoon naam="waarschuwing" maat={20} />}
      <span>{melding.tekst}</span>
      {melding.opnieuw && <button type="button" className="knop" onClick={() => { const f = melding.opnieuw!; sluit(); f(); }}>Opnieuw proberen</button>}
    </div>
  );
}
