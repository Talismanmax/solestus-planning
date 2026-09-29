import Weekplanning from "./Weekplanning";
import { createClient, getGebruiker } from "@/lib/supabase/server";
import { plusDagen, weekUitParam, type Afwezigheid, type Medewerker, type Opdrachtgever, type Vak, type WeekOpmerking } from "@/lib/planning";

export default async function WeekplanningPagina({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: p } = await searchParams;
  const { jaar, week, maandag } = weekUitParam(p);
  const zondag = plusDagen(maandag, 6);
  const supabase = await createClient();
  const gebruiker = await getGebruiker();

  const [mw, og, vk, af, op, laatst] = await Promise.all([
    supabase.from("medewerkers").select("id, naam, groep, bv, nationaliteit, certificaten, bron, volgorde").eq("actief", true).order("volgorde").order("naam"),
    supabase.from("opdrachtgevers").select("id, naam, korte_naam, plaats").eq("actief", true).order("naam"),
    supabase.from("vakken").select("id, medewerker_id, datum, status, opdrachtgever_id, notitie").gte("datum", maandag).lte("datum", zondag),
    supabase.from("afwezigheid").select("id, medewerker_id, soort, van, tot_en_met").lte("van", zondag).gte("tot_en_met", maandag),
    supabase.from("week_opmerkingen").select("id, medewerker_id, tekst").eq("jaar", jaar).eq("week", week),
    supabase.from("wijzigingen").select("tijdstip, omschrijving, gebruikers(naam, email)").order("tijdstip", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const fout = mw.error || og.error || vk.error || af.error || op.error;
  const l = laatst.data as unknown as { tijdstip: string; gebruikers: { naam: string | null; email: string } | null } | null;

  return (
    <Weekplanning
      jaar={jaar}
      week={week}
      maandag={maandag}
      medewerkers={(mw.data ?? []) as Medewerker[]}
      opdrachtgevers={(og.data ?? []) as Opdrachtgever[]}
      vakken={(vk.data ?? []) as Vak[]}
      afwezigheid={(af.data ?? []) as Afwezigheid[]}
      opmerkingen={(op.data ?? []) as WeekOpmerking[]}
      magWijzigen={gebruiker?.rol === "planner"}
      laatstGewijzigd={l ? { tijdstip: l.tijdstip, door: l.gebruikers?.naam || l.gebruikers?.email || "onbekend" } : null}
      laadFout={fout ? fout.message : null}
    />
  );
}
