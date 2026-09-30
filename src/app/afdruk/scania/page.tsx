import ScaniaAfdruk from "./ScaniaAfdruk";
import { laadScania } from "@/lib/laden";
import { weekUitParam } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";

export default async function AfdrukScania({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: p } = await searchParams;
  const { week, maandag } = weekUitParam(p);
  const supabase = await createClient();
  const [d, gebruiker] = await Promise.all([laadScania(supabase, maandag), getGebruiker()]);
  return <ScaniaAfdruk week={week} maandag={maandag} d={d} gebruiker={gebruiker} />;
}
