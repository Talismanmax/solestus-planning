import Stamgegevens from "./Stamgegevens";
import { createClient, getGebruiker } from "@/lib/supabase/server";

export default async function StamgegevensPagina() {
  const supabase = await createClient();
  const gebruiker = await getGebruiker();
  const [mw, og, log] = await Promise.all([
    supabase.from("medewerkers").select("id, naam, groep, bv, werkmaatschappijen, nationaliteit, certificaten, bron, ef_registratienummer, telefoon, actief, vaste_inzet").order("volgorde").order("naam"),
    supabase.from("opdrachtgevers").select("id, naam, plaats, korte_naam, actief, werkmaatschappijen, kvk_nummer").eq("actief", true).order("naam"),
    supabase.from("koppeling_log").select("tijdstip, gelukt, foutmelding, medewerkers_bijgewerkt, opdrachtgevers_bijgewerkt").order("tijdstip", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return (
    <Stamgegevens
      medewerkers={mw.data ?? []}
      opdrachtgevers={og.data ?? []}
      laatsteSync={log.data ?? null}
      magWijzigen={gebruiker?.rol === "planner"}
    />
  );
}
