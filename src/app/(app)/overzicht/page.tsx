import Overzicht from "./Overzicht";
import { createClient, getGebruiker } from "@/lib/supabase/server";
import { plusDagen, weekUitParam, type Afwezigheid, type Vak } from "@/lib/planning";
import type { OverzichtMedewerker } from "@/lib/overzicht";

export default async function OverzichtPagina({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: p } = await searchParams;
  const { week, maandag } = weekUitParam(p);
  const zondag = plusDagen(maandag, 6);
  const supabase = await createClient();
  const gebruiker = await getGebruiker();

  const [mw, og, vk, af] = await Promise.all([
    supabase.from("medewerkers").select("id, naam, groep").eq("actief", true).order("naam"),
    // Ook inactieve opdrachtgevers: een vak kan nog naar een oude opdrachtgever verwijzen.
    supabase.from("opdrachtgevers").select("id, naam, korte_naam"),
    supabase.from("vakken").select("id, medewerker_id, datum, status, opdrachtgever_id, notitie").gte("datum", maandag).lte("datum", zondag),
    supabase.from("afwezigheid").select("id, medewerker_id, soort, van, tot_en_met, notitie, medewerkers(naam)").lte("van", zondag).gte("tot_en_met", maandag).order("van"),
  ]);

  const fout = mw.error || og.error || vk.error || af.error;
  const afwezigheid = (af.data ?? []) as unknown as (Afwezigheid & { medewerkers: { naam: string } | null })[];

  return (
    <Overzicht
      week={week}
      maandag={maandag}
      medewerkers={(mw.data ?? []) as OverzichtMedewerker[]}
      opdrachtgevers={og.data ?? []}
      vakken={(vk.data ?? []) as Vak[]}
      afwezigheid={afwezigheid.map(({ medewerkers, ...a }) => ({ ...a, naam: medewerkers?.naam ?? "Onbekende medewerker" }))}
      magWijzigen={gebruiker?.rol === "planner"}
      laadFout={fout ? fout.message : null}
    />
  );
}
