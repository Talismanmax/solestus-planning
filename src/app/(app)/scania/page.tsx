import Scania from "./Scania";
import { laadScania } from "@/lib/laden";
import { weekUitParam } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";

export default async function ScaniaPagina({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: p } = await searchParams;
  const { week, maandag } = weekUitParam(p);
  const supabase = await createClient();
  const [data, gebruiker] = await Promise.all([laadScania(supabase, maandag), getGebruiker()]);
  return <Scania week={week} maandag={maandag} {...data} magWijzigen={gebruiker?.rol === "planner"} />;
}
