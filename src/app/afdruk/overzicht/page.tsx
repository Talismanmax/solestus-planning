import OverzichtAfdruk from "./OverzichtAfdruk";
import { laadOverzicht } from "@/lib/laden";
import { weekUitParam } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";

export default async function AfdrukOverzicht({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: p } = await searchParams;
  const { week, maandag } = weekUitParam(p);
  const supabase = await createClient();
  const [d, gebruiker] = await Promise.all([laadOverzicht(supabase, maandag), getGebruiker()]);
  return <OverzichtAfdruk week={week} maandag={maandag} d={d} gebruiker={gebruiker} />;
}
