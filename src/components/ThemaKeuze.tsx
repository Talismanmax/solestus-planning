"use client";

import { useEffect, useState } from "react";
import { leesThema, zetThema, type Thema } from "@/lib/thema";

const KEUZES: { id: Thema; label: string }[] = [
  { id: "licht", label: "Licht" },
  { id: "donker", label: "Donker" },
  { id: "systeem", label: "Systeem" },
];

/** Keuze tussen licht, donker en de instelling van het systeem (in het profielmenu). */
export default function ThemaKeuze() {
  const [thema, setThema] = useState<Thema>("systeem");
  useEffect(() => { setThema(leesThema()); }, []);

  return (
    <div className="thema-keuze">
      <span id="thema-kop">Weergave</span>
      <div className="seg seg-vol" role="group" aria-labelledby="thema-kop">
        {KEUZES.map((k) => (
          <button key={k.id} type="button" aria-pressed={thema === k.id} onClick={() => { zetThema(k.id); setThema(k.id); }}>{k.label}</button>
        ))}
      </div>
    </div>
  );
}
