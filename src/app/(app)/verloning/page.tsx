import Verloning from "./Verloning";
import { laadVerloning } from "@/lib/laden";
import { isoWeek, periodeUitParam, vandaagNL } from "@/lib/planning";
import { createClient, getGebruiker } from "@/lib/supabase/server";
import { korteNaam } from "@/lib/namen";

export default async function VerloningPagina({ searchParams }: { searchParams: Promise<{ periode?: string; week?: string; bv?: string }> }) {
  const { periode: pp, week: wp, bv } = await searchParams;
  const periode = periodeUitParam(pp);
  // Tab: de gevraagde week, anders de huidige week als die in de periode valt, anders de eerste.
  const nu = isoWeek(vandaagNL());
  const week = periode.weken.includes(Number(wp)) ? Number(wp)
    : nu.jaar === periode.jaar && periode.weken.includes(nu.week) ? nu.week : periode.weken[0];
  const supabase = await createClient();
  const [data, gebruiker] = await Promise.all([laadVerloning(supabase, periode.jaar, periode.periode, periode.weken), getGebruiker()]);
  const ik = gebruiker ? { id: gebruiker.id, naam: korteNaam(gebruiker) } : null;
  return <Verloning periode={periode} week={week} bv={bv ?? ""} ik={ik} {...data} />;
}
