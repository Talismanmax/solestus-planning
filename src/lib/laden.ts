import type { createClient } from "@/lib/supabase/server";
import { SCANIA_RELATIE, plusDagen, type Afwezigheid, type Medewerker, type Opdrachtgever, type Vak, type WeekOpmerking } from "@/lib/planning";
import type { Chauffeur, Rit } from "@/lib/scania";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Alles voor de weekplanning (scherm en PDF). */
export async function laadWeek(supabase: Db, jaar: number, week: number, maandag: string) {
  const zondag = plusDagen(maandag, 6);
  const [mw, og, vk, af, op, laatst] = await Promise.all([
    supabase.from("medewerkers").select("id, naam, groep, bv, nationaliteit, certificaten, bron, volgorde, vaste_inzet").eq("actief", true).order("volgorde").order("naam"),
    supabase.from("opdrachtgevers").select("id, naam, korte_naam, plaats").eq("actief", true).order("naam"),
    supabase.from("vakken").select("id, medewerker_id, datum, status, opdrachtgever_id, notitie").gte("datum", maandag).lte("datum", zondag),
    supabase.from("afwezigheid").select("id, medewerker_id, soort, van, tot_en_met").lte("van", zondag).gte("tot_en_met", maandag),
    supabase.from("week_opmerkingen").select("id, medewerker_id, tekst").eq("jaar", jaar).eq("week", week),
    supabase.from("wijzigingen").select("tijdstip, omschrijving, gebruikers(naam, email)").order("tijdstip", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const fout = mw.error || og.error || vk.error || af.error || op.error;
  const l = laatst.data as unknown as { tijdstip: string; gebruikers: { naam: string | null; email: string } | null } | null;
  return {
    medewerkers: (mw.data ?? []) as Medewerker[],
    opdrachtgevers: (og.data ?? []) as Opdrachtgever[],
    vakken: (vk.data ?? []) as Vak[],
    afwezigheid: (af.data ?? []) as Afwezigheid[],
    opmerkingen: (op.data ?? []) as WeekOpmerking[],
    laatstGewijzigd: l ? { tijdstip: l.tijdstip, door: l.gebruikers?.naam || l.gebruikers?.email || "onbekend" } : null,
    laadFout: fout ? fout.message : null,
  };
}

/** Alles voor de Scania-ritten (scherm en PDF). */
export async function laadScania(supabase: Db, maandag: string) {
  const zondag = plusDagen(maandag, 6);
  const [ritten, chauffeurs, scania, afw, vakken] = await Promise.all([
    supabase.from("scania_ritten").select("id, vertrekdatum, dienst, route, chauffeur_id, notitie, rit_delen(id, volgorde, van, naar, vertrek, aankomst)")
      .gte("vertrekdatum", plusDagen(maandag, -2)).lte("vertrekdatum", plusDagen(zondag, 1)).order("vertrekdatum"),
    supabase.from("medewerkers").select("id, naam, groep, nationaliteit").eq("actief", true).in("groep", ["nl", "int"]).order("naam"),
    supabase.from("opdrachtgevers").select("id, naam").ilike("naam", SCANIA_RELATIE).eq("actief", true).limit(1).maybeSingle(),
    supabase.from("afwezigheid").select("id, medewerker_id, soort, van, tot_en_met").lte("van", zondag).gte("tot_en_met", maandag),
    supabase.from("vakken").select("id, medewerker_id, datum, status, opdrachtgever_id, notitie").gte("datum", maandag).lte("datum", zondag),
  ]);
  return {
    ritten: (ritten.data ?? []) as Rit[],
    chauffeurs: (chauffeurs.data ?? []) as Chauffeur[],
    scaniaId: (scania.data?.id as string | undefined) ?? null,
    afwezigheid: (afw.data ?? []) as Afwezigheid[],
    vakken: (vakken.data ?? []) as Vak[],
    laadFout: ritten.error?.message ?? chauffeurs.error?.message ?? null,
  };
}

export type AfwezigheidMetNaam = Afwezigheid & { naam: string };

/** Alles voor het overzicht (scherm en PDF). */
export async function laadOverzicht(supabase: Db, maandag: string) {
  const zondag = plusDagen(maandag, 6);
  const [mw, og, vk, af] = await Promise.all([
    supabase.from("medewerkers").select("id, naam, groep").eq("actief", true).order("naam"),
    // Ook inactieve opdrachtgevers: een vak kan nog naar een oude opdrachtgever verwijzen.
    supabase.from("opdrachtgevers").select("id, naam, korte_naam"),
    supabase.from("vakken").select("id, medewerker_id, datum, status, opdrachtgever_id, notitie").gte("datum", maandag).lte("datum", zondag),
    supabase.from("afwezigheid").select("id, medewerker_id, soort, van, tot_en_met, notitie, medewerkers(naam)").lte("van", zondag).gte("tot_en_met", maandag).order("van"),
  ]);
  const fout = mw.error || og.error || vk.error || af.error;
  const rijen = (af.data ?? []) as unknown as (Afwezigheid & { medewerkers: { naam: string } | null })[];
  return {
    medewerkers: (mw.data ?? []) as Pick<Medewerker, "id" | "naam" | "groep">[],
    opdrachtgevers: (og.data ?? []) as Pick<Opdrachtgever, "id" | "naam" | "korte_naam">[],
    vakken: (vk.data ?? []) as Vak[],
    afwezigheid: rijen.map(({ medewerkers, ...a }) => ({ ...a, naam: medewerkers?.naam ?? "Onbekende medewerker" })) as AfwezigheidMetNaam[],
    laadFout: fout ? fout.message : null,
  };
}
