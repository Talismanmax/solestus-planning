import Overzicht from "./Overzicht";
import { laadOverzicht } from "@/lib/laden";
import { weekUitParam } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";

export default async function OverzichtPagina({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: p } = await searchParams;
  const { week, maandag } = weekUitParam(p);
  const supabase = await createClient();
  const [data, gebruiker] = await Promise.all([laadOverzicht(supabase, maandag), getGebruiker()]);
  return <Overzicht week={week} maandag={maandag} {...data} magWijzigen={gebruiker?.rol === "planner"} />;
}
