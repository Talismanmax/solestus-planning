import { redirect } from "next/navigation";
import { Suspense } from "react";
import Navigatiebalk from "@/components/Navigatiebalk";
import SessieBewaker from "@/components/SessieBewaker";
import { maandagVan, isoWeek, vandaagNL } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";
import { naarIso } from "@/lib/tijd";

/** "MA" voor Max, "MZ" voor Max Zomer. */
function initialen(naam: string) {
  const w = naam.trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : naam.slice(0, 2)).toUpperCase();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) redirect("/inloggen?staat=mislukt");

  // Aantal wijzigingen sinds maandag 00:00 (Nederlandse tijd), voor de teller in de navigatiebalk.
  const nu = isoWeek(vandaagNL());
  const supabase = await createClient();
  const { count } = await supabase.from("wijzigingen").select("id", { count: "exact", head: true })
    .gte("tijdstip", naarIso(`${maandagVan(nu.jaar, nu.week)}T00:00`));

  const naam = gebruiker.naam || gebruiker.email.split("@")[0];
  return (
    <>
      <Navigatiebalk naam={naam} email={gebruiker.email} rol={gebruiker.rol} wijzigingenDezeWeek={count ?? 0} />
      {children}
      <Suspense fallback={null}><SessieBewaker naam={naam} email={gebruiker.email} initialen={initialen(naam)} /></Suspense>
    </>
  );
}
