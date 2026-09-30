import type { createClient } from "@/lib/supabase/client";

type Db = ReturnType<typeof createClient>;

/**
 * Regel in het wijzigingenlog op naam van de ingelogde gebruiker. De gebruiker komt uit de lokale sessie
 * (geen extra aanroep naar de auth-server); de database controleert met RLS dat het de eigen naam is.
 */
export async function logWijziging(supabase: Db, tabel: string, omschrijving: string, recordId?: string | null) {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (id) await supabase.from("wijzigingen").insert({ gebruiker_id: id, tabel, omschrijving, record_id: recordId ?? null });
}
