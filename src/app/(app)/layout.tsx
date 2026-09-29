import { redirect } from "next/navigation";
import Navigatiebalk from "@/components/Navigatiebalk";
import { maandagVan, isoWeek, vandaagNL } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";
import { naarIso } from "@/lib/tijd";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) redirect("/inloggen?staat=mislukt");

  // Aantal wijzigingen sinds maandag 00:00 (Nederlandse tijd), voor de teller in de navigatiebalk.
  const nu = isoWeek(vandaagNL());
  const supabase = await createClient();
  const { count } = await supabase.from("wijzigingen").select("id", { count: "exact", head: true })
    .gte("tijdstip", naarIso(`${maandagVan(nu.jaar, nu.week)}T00:00`));

  return (
    <>
      <Navigatiebalk naam={gebruiker.naam || gebruiker.email.split("@")[0]} email={gebruiker.email} rol={gebruiker.rol} wijzigingenDezeWeek={count ?? 0} />
      {children}
    </>
  );
}
