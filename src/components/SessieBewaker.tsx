"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import InlogKnop from "@/app/inloggen/InlogKnop";
import Woordmerk from "@/components/Woordmerk";
import { createClient } from "@/lib/supabase/client";

/**
 * Houdt de sessie in de gaten. Verloopt die terwijl de planning openstaat (bijv. na lang niets doen),
 * dan verschijnt "Je sessie is verlopen" over het scherm heen; na opnieuw inloggen kom je terug op dezelfde pagina.
 */
export default function SessieBewaker({ naam, email, initialen, startVerlopen = false }: { naam: string; email: string; initialen: string; startVerlopen?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const pad = usePathname();
  const zoek = useSearchParams();
  const [verlopen, setVerlopen] = useState(startVerlopen);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") setVerlopen(true); });
    const controleer = async () => {
      if (document.visibilityState !== "visible") return;
      const { data: u, error } = await supabase.auth.getUser();
      // Alleen bij een echte afwijzing (geen netwerkfout) de sessie als verlopen zien.
      if (!u.user && error && error.status && error.status >= 400 && error.status < 500) setVerlopen(true);
    };
    document.addEventListener("visibilitychange", controleer);
    const klok = setInterval(controleer, 5 * 60 * 1000);
    return () => { data.subscription.unsubscribe(); document.removeEventListener("visibilitychange", controleer); clearInterval(klok); };
  }, [supabase]);

  if (!verlopen) return null;
  const volgende = `${pad}${zoek.toString() ? `?${zoek.toString()}` : ""}`;
  return (
    <div className="dialoog-achter" style={{ zIndex: 80 }}>
      <section className="dialoog" role="alertdialog" aria-modal="true" aria-labelledby="sessie-titel" style={{ width: 460, gap: 16 }}>
        <div style={{ alignSelf: "flex-start", display: "flex" }}><Woordmerk hoogte={24} /></div>
        <h2 id="sessie-titel" className="machina" style={{ fontSize: 30 }}>Je sessie is verlopen</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: "24px" }}>Je was een tijd niet actief. Log opnieuw in om verder te plannen. Wat al was opgeslagen, blijft gewoon staan.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--grijs)", borderRadius: 16, padding: "12px 12px" }}>
          <span className="avatar machina">{initialen}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 13 }}><strong style={{ fontSize: 14 }}>{naam}</strong>{email}</span>
        </div>
        <InlogKnop label="Opnieuw inloggen met Microsoft" volgende={volgende} />
        <InlogKnop label="Met een ander account inloggen" volgende={volgende} anderAccount alsLink />
      </section>
    </div>
  );
}
