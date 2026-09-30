import Weekplanning from "./Weekplanning";
import { laadWeek } from "@/lib/laden";
import { weekUitParam } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";

export default async function WeekplanningPagina({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: p } = await searchParams;
  const { jaar, week, maandag } = weekUitParam(p);
  const supabase = await createClient();
  const [data, gebruiker] = await Promise.all([laadWeek(supabase, jaar, week, maandag), getGebruiker()]);
  return <Weekplanning jaar={jaar} week={week} maandag={maandag} {...data} magWijzigen={gebruiker?.rol === "planner"} />;
}
