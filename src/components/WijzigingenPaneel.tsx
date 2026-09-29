"use client";

import { useEffect, useMemo, useState } from "react";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import { createClient } from "@/lib/supabase/client";
import { isoWeek, tijdstipNL, vandaagNL } from "@/lib/planning";

type Regel = { id: number; tijdstip: string; omschrijving: string; gebruikers: { naam: string | null; email: string } | null };

/** Laatste wijzigingen in de planning, nieuwste bovenaan. */
export default function WijzigingenPaneel({ onSluit }: { onSluit: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [regels, setRegels] = useState<Regel[] | null>(null);
  const [fout, setFout] = useState(false);
  const week = isoWeek(vandaagNL()).week;

  useEffect(() => {
    supabase.from("wijzigingen").select("id, tijdstip, omschrijving, gebruikers(naam, email)").order("tijdstip", { ascending: false }).limit(100)
      .then(({ data, error }) => { if (error) setFout(true); else setRegels(data as unknown as Regel[]); });
  }, [supabase]);

  return (
    <PaneelSchil
      boven={`Week ${week}`}
      titel="Wijzigingen"
      sub={regels ? `${regels.length === 100 ? "de laatste 100" : regels.length} wijzigingen, nieuwste bovenaan` : "laden…"}
      onSluit={onSluit}
      voet={<PaneelVoet onAnnuleren={onSluit} annulerenLabel="Sluiten" />}
    >
      {fout && <div className="melding melding-fout" style={{ maxWidth: "none" }}>De wijzigingen konden niet worden geladen.</div>}
      {regels?.length === 0 && <p style={{ margin: 0 }}>Nog geen wijzigingen.</p>}
      {regels && regels.length > 0 && (
        <ol className="wijzigingen">
          {regels.map((r) => (
            <li key={r.id}>
              <small><span>{tijdstipNL(r.tijdstip)}</span><strong>{r.gebruikers?.naam?.split(" ")[0] || r.gebruikers?.email.split("@")[0] || "Koppeling"}</strong></small>
              <span>{r.omschrijving}</span>
            </li>
          ))}
        </ol>
      )}
    </PaneelSchil>
  );
}
