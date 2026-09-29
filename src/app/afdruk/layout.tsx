import { redirect } from "next/navigation";
import "./afdruk.css";
import { getGebruiker } from "@/lib/supabase/server";

export const metadata = { title: "Afdrukken · Solestus Planning" };

export default async function AfdrukLayout({ children }: { children: React.ReactNode }) {
  if (!(await getGebruiker())) redirect("/inloggen?staat=mislukt");
  return <div className="afdruk">{children}</div>;
}
