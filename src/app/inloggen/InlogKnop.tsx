"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function InlogKnop({ label }: { label: string }) {
  const [bezig, setBezig] = useState(false);

  async function inloggen() {
    setBezig(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "openid email profile", redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button type="button" className="knop knop-zwart knop-groot" onClick={inloggen} disabled={bezig}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      {bezig ? "Doorsturen naar Microsoft…" : label}
    </button>
  );
}
