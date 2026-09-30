// Haalt medewerkers (flexkrachten) op uit Easyflex2go en zet ze in de planning.
// Easyflex2go is leidend: de velden uit Easyflex2go worden overschreven, planningsgegevens
// (volgorde, vaste inzet, verborgen) blijven staan. Opdrachtgevers komen niet uit Easyflex2go:
// die maken planners zelf aan in Stamgegevens.
//
// Geheimen (Supabase → Edge Functions → Secrets):
//   EASYFLEX_API_TOKEN  – API-token van Easyflex2go (tenant-token)
//   EASYFLEX_FROM       – e-mailadres voor de verplichte From-header (optioneel)
//
// Wie mag starten: de cron-taak (header x-sync-sleutel, sleutel staat in private.instellingen)
// of een ingelogde planner (knop "Nu bijwerken" in Stamgegevens).
import { createClient } from "npm:@supabase/supabase-js@2";

const MIN_INTERVAL_MS = 5 * 60 * 1000; // na een gelukte synchronisatie
const MIN_INTERVAL_FOUT_MS = 60 * 1000; // na een mislukte poging

/** Fout met een korte melding voor planners; de details gaan alleen naar de functielogs. */
class KoppelingFout extends Error {}

type FlexWorker = {
  id: number; full_name: string | null; first_name: string | null; insertion: string | null; last_name: string | null;
  easyflex_registration_number: string | null; nationality_iso: string | null; nationality: string | null;
  flex_worker_state: number; deleted_at: string | null; type: number;
  operating_company?: { name: string } | null; labels?: { label_name: string }[];
};
const STATUS = { 1: "Ingeschreven", 2: "Actief", 3: "Passief", 4: "Uitgeschreven" } as Record<number, string>;

// De aanvragen lopen via de database (functie easyflex_ophalen), zodat ze altijd
// van hetzelfde IP-adres komen. Dat adres staat op de IP-whitelist van het token.
// deno-lint-ignore no-explicit-any
async function haalAlles<T>(db: any, pad: string, extra: string): Promise<T[]> {
  const token = Deno.env.get("EASYFLEX_API_TOKEN")?.trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
  if (!token) throw new KoppelingFout("EASYFLEX_API_TOKEN ontbreekt in de Supabase-secrets");
  const from = Deno.env.get("EASYFLEX_FROM") ?? "m.zomer@solestus.com";
  const { data, error } = await db.rpc("easyflex_ophalen", { pad, token, afzender: from, extra });
  if (error) {
    const m = /EASYFLEX_HTTP_(\d+)/.exec(error.message);
    const status = m ? Number(m[1]) : 0;
    if (status === 401) throw new KoppelingFout("Easyflex2go accepteert het API-token niet. Controleer het token en de IP-whitelist (63.186.227.188).");
    if (status === 403) throw new KoppelingFout(`Het API-token mist rechten voor ${pad} (nodig: flex_workers_read).`);
    console.error(`Easyflex2go ${pad}:`, error.message);
    throw new KoppelingFout(`Easyflex2go gaf een fout bij ${pad}${status ? ` (code ${status})` : ""}. Probeer het later opnieuw.`);
  }
  return (data ?? []) as T[];
}

// Naam in de planning: "Voornaam tussenvoegsel Achternaam"; zonder achternaam de volledige naam uit Easyflex2go.
function naamVan(f: FlexWorker) {
  const delen = [f.first_name, f.insertion, f.last_name].map((x) => x?.trim()).filter(Boolean);
  return (f.last_name?.trim() ? delen.join(" ") : "") || f.full_name?.trim() || delen.join(" ") || `Flexkracht ${f.id}`;
}

// deno-lint-ignore no-explicit-any
async function wieStart(req: Request, db: any): Promise<{ soort: "cron" } | { soort: "planner"; id: string } | null> {
  const sleutel = req.headers.get("x-sync-sleutel");
  if (sleutel) {
    const { data } = await db.rpc("easyflex_sync_sleutel_klopt", { sleutel });
    if (data === true) return { soort: "cron" };
  }
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data: auth } = await db.auth.getUser(jwt);
  if (!auth?.user) return null;
  const { data: g } = await db.from("gebruikers").select("rol").eq("id", auth.user.id).maybeSingle();
  return g?.rol === "planner" ? { soort: "planner", id: auth.user.id } : null;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });

  const wie = await wieStart(req, db);
  if (!wie) return json({ gelukt: false, fout: "Alleen planners kunnen de koppeling starten." }, 403);

  // Niet vaker dan eens per 5 minuten na een gelukte synchronisatie, en eens per minuut na een mislukte poging.
  const { data: laatste } = await db.from("koppeling_log").select("tijdstip, gelukt").order("tijdstip", { ascending: false }).limit(1).maybeSingle();
  if (laatste && Date.now() - new Date(laatste.tijdstip).getTime() < (laatste.gelukt ? MIN_INTERVAL_MS : MIN_INTERVAL_FOUT_MS)) {
    return json({ overgeslagen: true, reden: laatste.gelukt ? "Minder dan 5 minuten geleden bijgewerkt" : "Net nog geprobeerd; probeer het over een minuut opnieuw" });
  }

  try {
    const flex = await haalAlles<FlexWorker>(db, "/flex-workers", "&include=operating_company,labels");
    // Medewerkers: records van dezelfde persoon (zelfde registratienummer) samenvoegen
    const RANG: Record<number, number> = { 2: 4, 1: 3, 3: 2, 4: 1 };
    const perPersoon = new Map<string, FlexWorker[]>();
    for (const f of flex) {
      const regnr = (f.easyflex_registration_number ?? "").trim();
      const sleutel = regnr ? `r:${regnr}` : `id:${f.id}`;
      perPersoon.set(sleutel, [...(perPersoon.get(sleutel) ?? []), f]);
    }
    const mwGroepen = [...perPersoon.values()].map((leden) => ({
      leden: leden.map((f) => {
        const iso = (f.nationality_iso ?? "").toUpperCase();
        return {
          id: f.id,
          naam: naamVan(f),
          voornaam: f.first_name?.trim() ?? "",
          tussenvoegsel: f.insertion?.trim() ?? "",
          achternaam: f.last_name?.trim() ?? "",
          regnr: (f.easyflex_registration_number ?? "").trim(),
          nat: iso,
          groep: iso === "NL" || iso === "" ? "nl" : "int",
          wm: f.operating_company?.name ?? null,
          status: STATUS[f.flex_worker_state] ?? String(f.flex_worker_state),
          rang: f.deleted_at ? 0 : (RANG[f.flex_worker_state] ?? 0),
          // Alleen status Actief telt; Ingeschreven, Passief en Uitgeschreven zijn verborgen in de planning.
          actief: !f.deleted_at && f.flex_worker_state === 2,
          certificaten: (f.labels ?? []).map((l) => l.label_name).filter(Boolean),
        };
      }),
    }));
    const { data: mv, error: mvFout } = await db.rpc("medewerkers_samenvoegen", { groepen: mwGroepen });
    if (mvFout) { console.error("medewerkers_samenvoegen:", mvFout.message); throw new KoppelingFout("Opslaan van de medewerkers is niet gelukt."); }
    const mwUit = (mv ?? {}) as { medewerkers?: number; actief?: number; samengevoegd?: number };

    await db.from("koppeling_log").insert({ gelukt: true, medewerkers_bijgewerkt: mwUit.medewerkers ?? flex.length });
    if (wie.soort === "planner") {
      await db.from("wijzigingen").insert({ gebruiker_id: wie.id, tabel: "koppeling_log", omschrijving: `Easyflex2go handmatig bijgewerkt: ${mwUit.medewerkers ?? flex.length} medewerkers` });
    }
    return json({ gelukt: true, flexkrachtrecords: flex.length, medewerkers: mwUit.medewerkers, actief: mwUit.actief, medewerkersSamengevoegd: mwUit.samengevoegd });
  } catch (e) {
    if (!(e instanceof KoppelingFout)) console.error(e);
    const fout = e instanceof KoppelingFout ? e.message : "Bijwerken is niet gelukt door een onverwachte fout.";
    await db.from("koppeling_log").insert({ gelukt: false, foutmelding: fout });
    return json({ gelukt: false, fout }, 502);
  }
});
