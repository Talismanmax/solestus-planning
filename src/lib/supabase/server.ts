import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Aangeroepen vanuit een servercomponent: de proxy ververst de sessie al.
          }
        },
      },
    },
  );
}

type Gebruiker = { id: string; naam: string | null; email: string; rol: "planner" | "lezer" };

/** Ingelogde gebruiker met rol, of null. Eén keer per request opgehaald (layout en pagina delen het). */
export const getGebruiker = cache(async (): Promise<Gebruiker | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("gebruikers").select("id, naam, email, rol").eq("id", auth.user.id).maybeSingle();
  return (data as Gebruiker | null) ?? null;
});
