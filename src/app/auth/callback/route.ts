import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const mislukt = NextResponse.redirect(`${origin}/inloggen?staat=mislukt`);
  if (!code) return mislukt;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return mislukt;

  // Alleen medewerkers van Solestus: er moet een gebruikersregel bestaan
  // (die maakt de database alleen aan voor @solestus.com).
  const email = (data.user.email ?? "").toLowerCase();
  const { data: gebruiker } = await supabase.from("gebruikers").select("id").eq("id", data.user.id).maybeSingle();
  if (!email.endsWith("@solestus.com") || !gebruiker) {
    await supabase.auth.signOut();
    return mislukt;
  }

  // Terug naar de pagina waar iemand was (alleen een pad binnen de app).
  const volgende = searchParams.get("volgende");
  const pad = volgende && volgende.startsWith("/") && !volgende.startsWith("//") ? volgende : "/";
  return NextResponse.redirect(`${origin}${pad}`);
}
