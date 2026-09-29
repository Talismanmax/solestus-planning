import WeekAfdruk from "./WeekAfdruk";
import { laadWeek } from "@/lib/laden";
import { weekUitParam } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";

export default async function AfdrukWeek({ searchParams }: { searchParams: Promise<{ week?: string; groep?: string; stand?: string }> }) {
  const { week: p, groep, stand } = await searchParams;
  const { jaar, week, maandag } = weekUitParam(p);
  const supabase = await createClient();
  const [d, gebruiker] = await Promise.all([laadWeek(supabase, jaar, week, maandag), getGebruiker()]);
  return <WeekAfdruk week={week} maandag={maandag} stand={stand === "staand" ? "staand" : "liggend"} groepId={groep} d={d} gebruiker={gebruiker} />;
}
