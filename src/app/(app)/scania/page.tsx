import Scania from "./Scania";
import { createClient, getGebruiker } from "@/lib/supabase/server";
import { plusDagen, weekUitParam, type Afwezigheid, type Vak } from "@/lib/planning";
import type { Chauffeur, Rit } from "@/lib/scania";

export default async function ScaniaPagina({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: p } = await searchParams;
  const { week, maandag } = weekUitParam(p);
  const zondag = plusDagen(maandag, 6);
  const supabase = await createClient();
  const gebruiker = await getGebruiker();

  const [ritten, chauffeurs, scania, afw, vakken] = await Promise.all([
    supabase.from("scania_ritten").select("id, vertrekdatum, dienst, route, chauffeur_id, notitie, rit_delen(id, volgorde, van, naar, vertrek, aankomst)")
      .gte("vertrekdatum", plusDagen(maandag, -2)).lte("vertrekdatum", plusDagen(zondag, 1)).order("vertrekdatum"),
    supabase.from("medewerkers").select("id, naam, groep, nationaliteit").eq("actief", true).in("groep", ["nl", "int"]).order("naam"),
    supabase.from("opdrachtgevers").select("id, naam").ilike("naam", "%scania%").eq("actief", true).limit(1).maybeSingle(),
    supabase.from("afwezigheid").select("id, medewerker_id, soort, van, tot_en_met").lte("van", zondag).gte("tot_en_met", maandag),
    supabase.from("vakken").select("id, medewerker_id, datum, status, opdrachtgever_id, notitie").gte("datum", maandag).lte("datum", zondag),
  ]);

  return (
    <Scania
      week={week}
      maandag={maandag}
      ritten={(ritten.data ?? []) as Rit[]}
      chauffeurs={(chauffeurs.data ?? []) as Chauffeur[]}
      scaniaId={scania.data?.id ?? null}
      afwezigheid={(afw.data ?? []) as Afwezigheid[]}
      vakken={(vakken.data ?? []) as Vak[]}
      magWijzigen={gebruiker?.rol === "planner"}
      laadFout={ritten.error?.message ?? chauffeurs.error?.message ?? null}
    />
  );
}
