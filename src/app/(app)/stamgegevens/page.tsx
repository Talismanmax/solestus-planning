import Stamgegevens from "./Stamgegevens";
import { isoWeek, maandagVan, plusDagen, vandaagNL } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";

export default async function StamgegevensPagina({ searchParams }: { searchParams: Promise<{ medewerker?: string }> }) {
  const { medewerker } = await searchParams;
  const supabase = await createClient();
  const nu = isoWeek(vandaagNL());
  const maandag = maandagVan(nu.jaar, nu.week);
  const [gebruiker, mw, og, log, gelukt, vk] = await Promise.all([
    getGebruiker(),
    supabase.from("medewerkers").select("id, naam, voornaam, tussenvoegsel, achternaam, groep, bv, werkmaatschappijen, nationaliteit, certificaten, bron, ef_registratienummer, ef_id, ef_status, telefoon, actief, verborgen, vaste_inzet").order("volgorde").order("achternaam").order("naam"),
    supabase.from("opdrachtgevers").select("id, naam, plaats, korte_naam, verborgen, scania").order("verborgen").order("naam"),
    supabase.from("koppeling_log").select("tijdstip, gelukt, foutmelding, medewerkers_bijgewerkt").order("tijdstip", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("koppeling_log").select("tijdstip, medewerkers_bijgewerkt").eq("gelukt", true).order("tijdstip", { ascending: false }).limit(1).maybeSingle(),
    // Diensten per opdrachtgever in de huidige week
    supabase.from("vakken").select("opdrachtgever_id").eq("status", "werk").gte("datum", maandag).lte("datum", plusDagen(maandag, 6)),
  ]);
  const diensten: Record<string, number> = {};
  for (const v of (vk.data ?? []) as { opdrachtgever_id: string | null }[]) if (v.opdrachtgever_id) diensten[v.opdrachtgever_id] = (diensten[v.opdrachtgever_id] ?? 0) + 1;

  return (
    <Stamgegevens
      medewerkers={mw.data ?? []}
      opdrachtgevers={og.data ?? []}
      laatsteSync={log.data ?? null}
      laatstGelukt={gelukt.data ?? null}
      week={nu.week}
      maandag={maandag}
      diensten={diensten}
      openMedewerker={medewerker ?? null}
      magWijzigen={gebruiker?.rol === "planner"}
    />
  );
}
