import { redirect } from "next/navigation";
import Navigatiebalk from "@/components/Navigatiebalk";
import { getGebruiker } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) redirect("/inloggen?staat=mislukt");

  return (
    <>
      <Navigatiebalk naam={gebruiker.naam || gebruiker.email.split("@")[0]} email={gebruiker.email} rol={gebruiker.rol} />
      {children}
    </>
  );
}
