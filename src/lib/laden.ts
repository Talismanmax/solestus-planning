import type { createClient } from "@/lib/supabase/server";
import { maandagVan, plusDagen, type Afwezigheid, type Medewerker, type Opdrachtgever, type Vak, type WeekOpmerking } from "@/lib/planning";
import type { Chauffeur, Rit } from "@/lib/scania";
import { korteNaam } from "@/lib/namen";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Kolommen die overal hetzelfde worden opgevraagd. */
export const VAK_KOLOMMEN = "id, medewerker_id, datum, status, opdrachtgever_id, notitie";
const AFWEZIG_KOLOMMEN = "id, medewerker_id, soort, van, tot_en_met";
const RIT_KOLOMMEN = "id, vertrekdatum, dienst, route, chauffeur_id, notitie, omschrijving, rit_delen(id, volgorde, van, naar, vertrek, aankomst)";

/** Alles voor de weekplanning (scherm en PDF). */
export async function laadWeek(supabase: Db, jaar: number, week: number, maandag: string) {
  const zondag = plusDagen(maandag, 6);
  const [mw, og, vk, af, op, laatst, rt] = await Promise.all([
    supabase.from("medewerkers").select("id, naam, groep, bv, nationaliteit, certificaten, bron, volgorde, vaste_inzet, telefoon").eq("actief", true).eq("verborgen", false).order("volgorde").order("achternaam").order("naam"),
    supabase.from("opdrachtgevers").select("id, naam, korte_naam, plaats, verborgen").order("naam"),
    supabase.from("vakken").select(VAK_KOLOMMEN).gte("datum", maandag).lte("datum", zondag),
    supabase.from("afwezigheid").select(AFWEZIG_KOLOMMEN).lte("van", zondag).gte("tot_en_met", maandag),
    supabase.from("week_opmerkingen").select("id, medewerker_id, tekst").eq("jaar", jaar).eq("week", week),
    supabase.from("wijzigingen").select("tijdstip, omschrijving, gebruikers(naam, email)").order("tijdstip", { ascending: false }).limit(1).maybeSingle(),
    // Scania-ritten van deze week, voor het weekbericht aan de chauffeur.
    supabase.from("scania_ritten").select(RIT_KOLOMMEN)
      .gte("vertrekdatum", maandag).lte("vertrekdatum", zondag).not("chauffeur_id", "is", null).order("vertrekdatum"),
  ]);
  const fout = mw.error || og.error || vk.error || af.error || op.error;
  const l = laatst.data as unknown as { tijdstip: string; gebruikers: { naam: string | null; email: string } | null } | null;
  return {
    medewerkers: (mw.data ?? []) as Medewerker[],
    opdrachtgevers: (og.data ?? []) as Opdrachtgever[],
    vakken: (vk.data ?? []) as Vak[],
    afwezigheid: (af.data ?? []) as Afwezigheid[],
    opmerkingen: (op.data ?? []) as WeekOpmerking[],
    ritten: (rt.data ?? []) as Rit[],
    laatstGewijzigd: l ? { tijdstip: l.tijdstip, door: l.gebruikers?.naam || l.gebruikers?.email || "onbekend" } : null,
    laadFout: fout ? fout.message : null,
  };
}

/** Alles voor de Scania-ritten (scherm en PDF). */
export async function laadScania(supabase: Db, maandag: string) {
  const zondag = plusDagen(maandag, 6);
  const [ritten, chauffeurs, scania, afw, vakken] = await Promise.all([
    supabase.from("scania_ritten").select(RIT_KOLOMMEN)
      .gte("vertrekdatum", plusDagen(maandag, -2)).lte("vertrekdatum", plusDagen(zondag, 1)).order("vertrekdatum"),
    supabase.from("medewerkers").select("id, naam, groep, nationaliteit").eq("actief", true).eq("verborgen", false).in("groep", ["nl", "int"]).order("achternaam").order("naam"),
    supabase.from("opdrachtgevers").select("id, naam, korte_naam").eq("scania", true).limit(1).maybeSingle(),
    supabase.from("afwezigheid").select(AFWEZIG_KOLOMMEN).lte("van", zondag).gte("tot_en_met", maandag),
    supabase.from("vakken").select(VAK_KOLOMMEN).gte("datum", maandag).lte("datum", zondag),
  ]);
  return {
    ritten: (ritten.data ?? []) as Rit[],
    chauffeurs: (chauffeurs.data ?? []) as Chauffeur[],
    scaniaId: (scania.data?.id as string | undefined) ?? null,
    scaniaNaam: (scania.data?.korte_naam || scania.data?.naam || "Scania") as string,
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
    supabase.from("medewerkers").select("id, naam, groep").eq("actief", true).eq("verborgen", false).order("achternaam").order("naam"),
    // Ook inactieve opdrachtgevers: een vak kan nog naar een oude opdrachtgever verwijzen.
    supabase.from("opdrachtgevers").select("id, naam, korte_naam"),
    supabase.from("vakken").select(VAK_KOLOMMEN).gte("datum", maandag).lte("datum", zondag),
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

export type Verwerkt = { medewerker_id: string; verwerkt_op: string; door: string };

/** Alles voor de verloning van één 4-wekenperiode: de planning van alle weken en wie al verwerkt is. */
export async function laadVerloning(supabase: Db, jaar: number, periode: number, weken: number[]) {
  const van = maandagVan(jaar, weken[0]);
  const tot = plusDagen(maandagVan(jaar, weken[weken.length - 1]), 6);
  const [mw, og, vk, af, op, vw] = await Promise.all([
    supabase.from("medewerkers").select("id, naam, groep, bv, werkmaatschappijen, nationaliteit, certificaten, bron, volgorde, telefoon").eq("actief", true).eq("verborgen", false).order("volgorde").order("achternaam").order("naam"),
    supabase.from("opdrachtgevers").select("id, naam, korte_naam, plaats, verborgen"),
    supabase.from("vakken").select(VAK_KOLOMMEN).gte("datum", van).lte("datum", tot),
    supabase.from("afwezigheid").select(AFWEZIG_KOLOMMEN).lte("van", tot).gte("tot_en_met", van),
    supabase.from("week_opmerkingen").select("id, medewerker_id, tekst, week").eq("jaar", jaar).in("week", weken),
    supabase.from("verloning_verwerkt").select("medewerker_id, verwerkt_op, gebruikers(naam, email)").eq("jaar", jaar).eq("periode", periode),
  ]);
  const fout = mw.error || og.error || vk.error || af.error || op.error || vw.error;
  const rijen = (vw.data ?? []) as unknown as { medewerker_id: string; verwerkt_op: string; gebruikers: { naam: string | null; email: string } | null }[];
  return {
    medewerkers: (mw.data ?? []) as (Medewerker & { werkmaatschappijen: string[] })[],
    opdrachtgevers: (og.data ?? []) as Opdrachtgever[],
    vakken: (vk.data ?? []) as Vak[],
    afwezigheid: (af.data ?? []) as Afwezigheid[],
    opmerkingen: (op.data ?? []) as (WeekOpmerking & { week: number })[],
    verwerkt: rijen.map((r) => ({ medewerker_id: r.medewerker_id, verwerkt_op: r.verwerkt_op, door: korteNaam(r.gebruikers) })) as Verwerkt[],
    laadFout: fout ? fout.message : null,
  };
}
