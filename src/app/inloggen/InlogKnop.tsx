"use client";

import { useState } from "react";
import Icoon from "@/components/Icoon";
import { createClient } from "@/lib/supabase/client";

/** Inloggen met Microsoft. `volgende` = pagina om na het inloggen naartoe te gaan; `anderAccount` laat Microsoft een account kiezen. */
export default function InlogKnop({ label, volgende, anderAccount = false, alsLink = false }: { label: string; volgende?: string; anderAccount?: boolean; alsLink?: boolean }) {
  const [bezig, setBezig] = useState(false);

  async function inloggen() {
    setBezig(true);
    const supabase = createClient();
    const terug = volgende && volgende.startsWith("/") && !volgende.startsWith("//") ? `?volgende=${encodeURIComponent(volgende)}` : "";
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid email profile",
        redirectTo: `${window.location.origin}/auth/callback${terug}`,
        queryParams: anderAccount ? { prompt: "select_account" } : undefined,
      },
    });
  }

  if (alsLink) return <button type="button" className="link-knop" style={{ alignSelf: "center", fontSize: 14 }} onClick={inloggen} disabled={bezig}>{label}</button>;
  return (
    <button type="button" className="knop knop-zwart knop-groot" onClick={inloggen} disabled={bezig}>
      <Icoon naam="slot" maat={20} />
      {bezig ? "Doorsturen naar Microsoft…" : label}
    </button>
  );
}
