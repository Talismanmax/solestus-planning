// Haalt medewerkers (flexkrachten) en opdrachtgevers (relaties) op uit Easyflex2go
// en zet ze in de planning. Easyflex2go is leidend: de velden uit Easyflex2go worden
// overschreven, planningsgegevens (volgorde, vaste inzet) blijven staan.
//
// Geheimen (Supabase → Edge Functions → Secrets):
//   EASYFLEX_API_TOKEN  – API-token van Easyflex2go (tenant-token)
//   EASYFLEX_FROM       – e-mailadres voor de verplichte From-header (optioneel)
//
// Wie mag starten: de cron-taak (header x-sync-sleutel, sleutel staat in private.instellingen)
// of een ingelogde planner (knop "Nu bijwerken" in Stamgegevens).
import { createClient } from "npm:@supabase/supabase-js@2";

const MIN_INTERVAL_MS = 5 * 60 * 1000;

type FlexWorker = {
  id: number; full_name: string | null; first_name: string | null; insertion: string | null; last_name: string | null;
  easyflex_registration_number: string | null; nationality_iso: string | null; nationality: string | null;
  flex_worker_state: number; deleted_at: string | null; type: number;
  operating_company?: { name: string } | null; labels?: { label_name: string }[];
};
type Relatie = {
  id: number; name: string; chamber_of_commerce_number: number | null;
  visiting_address?: { city: string | null } | null; operating_company?: { name: string } | null;
  state?: { attribute: string | null; translation: string | null } | null;
};

// Zelfde klant bij meer werkmaatschappijen: samenvoegen op naam (zonder leestekens) of KvK-nummer.
const normaal = (naam: string) => naam.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function groepeer(relaties: Relatie[]) {
  const ouder = new Map<number, number>();
  const vind = (x: number): number => { const p = ouder.get(x)!; if (p === x) return x; const r = vind(p); ouder.set(x, r); return r; };
  const koppel = (a: number, b: number) => { const ra = vind(a), rb = vind(b); if (ra !== rb) ouder.set(Math.max(ra, rb), Math.min(ra, rb)); };
  relaties.forEach((r) => ouder.set(r.id, r.id));
  const opNaam = new Map<string, number>(), opKvk = new Map<number, number>();
  for (const r of relaties) {
    const n = normaal(r.name);
    if (n) { if (opNaam.has(n)) koppel(r.id, opNaam.get(n)!); else opNaam.set(n, r.id); }
    const k = r.chamber_of_commerce_number;
    if (k) { if (opKvk.has(k)) koppel(r.id, opKvk.get(k)!); else opKvk.set(k, r.id); }
  }
  const groepen = new Map<number, Relatie[]>();
  for (const r of relaties) { const w = vind(r.id); groepen.set(w, [...(groepen.get(w) ?? []), r]); }
  return [...groepen.values()].map((leden) => ({
    leden: leden.map((r) => ({ id: r.id, naam: r.name, kvk: r.chamber_of_commerce_number ? String(r.chamber_of_commerce_number) : "", plaats: r.visiting_address?.city ?? "", wm: r.operating_company?.name ?? null, status: r.state?.attribute ?? r.state?.translation ?? null })),
  }));
}

const STATUS = { 1: "Ingeschreven", 2: "Actief", 3: "Passief", 4: "Uitgeschreven" } as Record<number, string>;

// De aanvragen lopen via de database (functie easyflex_ophalen), zodat ze altijd
// van hetzelfde IP-adres komen. Dat adres staat op de IP-whitelist van het token.
// deno-lint-ignore no-explicit-any
async function haalAlles<T>(db: any, pad: string, extra: string): Promise<T[]> {
  const token = Deno.env.get("EASYFLEX_API_TOKEN")?.trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
  if (!token) throw new Error("EASYFLEX_API_TOKEN ontbreekt in de Supabase-secrets");
  const from = Deno.env.get("EASYFLEX_FROM") ?? "m.zomer@solestus.com";
  const { data, error } = await db.rpc("easyflex_ophalen", { pad, token, afzender: from, extra });
  if (error) {
    const m = /EASYFLEX_HTTP_(\d+)/.exec(error.message);
    const status = m ? Number(m[1]) : 0;
    if (status === 401) throw new Error("Easyflex2go accepteert het API-token niet. Controleer het token en de IP-whitelist (63.186.227.188).");
    if (status === 403) throw new Error(`Het API-token mist rechten voor ${pad} (nodig: flex_workers_read en relations_read).`);
    throw new Error(`Easyflex2go ${pad}: ${error.message.slice(0, 300)}`);
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

  // Testmodus: één aanvraag via de database, alleen de uitkomst terug.
  const body = await req.json().catch(() => ({}));
  if (body?.test) {
    try {
      const bu = await haalAlles<unknown>(db, "/business-units", "");
      return json({ gelukt: true, werkmaatschappijen: bu.length });
    } catch (e) {
      return json({ gelukt: false, fout: e instanceof Error ? e.message : String(e) });
    }
  }

  // Niet vaker dan eens per 5 minuten.
  const { data: laatste } = await db.from("koppeling_log").select("tijdstip").eq("gelukt", true).order("tijdstip", { ascending: false }).limit(1).maybeSingle();
  if (laatste && Date.now() - new Date(laatste.tijdstip).getTime() < MIN_INTERVAL_MS) {
    return json({ overgeslagen: true, reden: "Minder dan 5 minuten geleden bijgewerkt" });
  }

  try {
    const [flex, relaties] = await Promise.all([
      haalAlles<FlexWorker>(db, "/flex-workers", "&include=operating_company,labels"),
      haalAlles<Relatie>(db, "/relations", "&include=visiting_address,operating_company,state"),
    ]);
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
    if (mvFout) throw new Error("Opslaan medewerkers: " + mvFout.message);
    const mwUit = (mv ?? {}) as { medewerkers?: number; actief?: number; samengevoegd?: number };

    // Opdrachtgevers: relaties van dezelfde klant samenvoegen
    const groepen = groepeer(relaties);
    const { data: sv, error: svFout } = await db.rpc("opdrachtgevers_samenvoegen", { groepen });
    if (svFout) throw new Error("Opslaan opdrachtgevers: " + svFout.message);

    // Eerste echte synchronisatie: voorbeeldgegevens opruimen.
    let voorbeeldOpgeruimd = false;
    if (flex.length > 0) {
      const { data: vbOg } = await db.from("opdrachtgevers").select("id").lt("ef_relatie_id", 0);
      const vbOgIds = (vbOg ?? []).map((o) => o.id);
      if (vbOgIds.length) await db.from("vakken").delete().in("opdrachtgever_id", vbOgIds);
      const { count } = await db.from("medewerkers").delete({ count: "exact" }).or("ef_id.lt.0,ef_status.eq.VOORBEELD");
      if (vbOgIds.length) await db.from("opdrachtgevers").delete().in("id", vbOgIds);
      voorbeeldOpgeruimd = (count ?? 0) > 0 || vbOgIds.length > 0;
    }

    const aantalOg = (sv as { opdrachtgevers: number } | null)?.opdrachtgevers ?? groepen.length;
    await db.from("koppeling_log").insert({ gelukt: true, medewerkers_bijgewerkt: mwUit.medewerkers ?? flex.length, opdrachtgevers_bijgewerkt: aantalOg });
    if (wie.soort === "planner") {
      await db.from("wijzigingen").insert({ gebruiker_id: wie.id, tabel: "koppeling_log", omschrijving: `Easyflex2go handmatig bijgewerkt: ${mwUit.medewerkers ?? flex.length} medewerkers, ${aantalOg} opdrachtgevers` });
    }
    return json({ gelukt: true, flexkrachtrecords: flex.length, medewerkers: mwUit.medewerkers, actief: mwUit.actief, medewerkersSamengevoegd: mwUit.samengevoegd, relaties: relaties.length, opdrachtgevers: aantalOg, samengevoegd: (sv as { samengevoegd: number } | null)?.samengevoegd ?? 0, voorbeeldOpgeruimd });
  } catch (e) {
    const fout = e instanceof Error ? e.message : String(e);
    await db.from("koppeling_log").insert({ gelukt: false, foutmelding: fout.slice(0, 500) });
    return json({ gelukt: false, fout }, 502);
  }
});
