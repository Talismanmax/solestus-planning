// Haalt medewerkers (flexkrachten) en opdrachtgevers (relaties) op uit Easyflex2go
// en zet ze in de planning. Easyflex2go is leidend: de velden uit Easyflex2go worden
// overschreven, planningsgegevens (volgorde, vaste inzet) blijven staan.
//
// Geheimen (Supabase → Edge Functions → Secrets):
//   EASYFLEX_API_TOKEN  – API-token van Easyflex2go (tenant-token)
//   EASYFLEX_FROM       – e-mailadres voor de verplichte From-header (optioneel)
import { createClient } from "npm:@supabase/supabase-js@2";

const BASIS = "https://solestus.easyflex2go.nl/api/v1";
const MIN_INTERVAL_MS = 5 * 60 * 1000;

type Pagina<T> = { data: T[]; pagination: { next_hash: string | null } };
type FlexWorker = {
  id: number; full_name: string | null; first_name: string | null; insertion: string | null; last_name: string | null;
  easyflex_registration_number: string | null; nationality_iso: string | null; nationality: string | null;
  flex_worker_state: number; deleted_at: string | null; type: number;
  operating_company?: { name: string } | null; labels?: { label_name: string }[];
};
type Relatie = { id: number; name: string; visiting_address?: { city: string | null } | null };

const STATUS = { 1: "Ingeschreven", 2: "Actief", 3: "Passief", 4: "Uitgeschreven" } as Record<number, string>;

async function haalAlles<T>(pad: string, params: Record<string, string>): Promise<T[]> {
  const token = Deno.env.get("EASYFLEX_API_TOKEN")?.trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
  if (!token) throw new Error("EASYFLEX_API_TOKEN ontbreekt in de Supabase-secrets");
  const from = Deno.env.get("EASYFLEX_FROM") ?? "m.zomer@solestus.com";
  const alles: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 400; i++) {
    const q = new URLSearchParams({ per_page: "50", ...params });
    if (cursor) q.set("cursor", cursor);
    const r = await fetch(`${BASIS}${pad}?${q}`, { headers: { Authorization: `Bearer ${token}`, From: from, Accept: "application/json" } });
    if (!r.ok) {
      const tekst = (await r.text()).slice(0, 300);
      const ruw = Deno.env.get("EASYFLEX_API_TOKEN") ?? "";
      const info = r.status === 401 ? ` (token: ${token.length} tekens, spaties/aanhalingstekens: ${/[\s"']/.test(ruw) ? "ja" : "nee"}, From: ${from})` : "";
      throw new Error(`Easyflex2go ${pad} gaf ${r.status}: ${tekst}${info}`);
    }
    const p = (await r.json()) as Pagina<T>;
    alles.push(...p.data);
    cursor = p.pagination?.next_hash ?? null;
    if (!cursor) break;
  }
  return alles;
}

function naamVan(f: FlexWorker) {
  return (f.full_name?.trim()) || [f.first_name, f.insertion, f.last_name].filter(Boolean).join(" ") || `Flexkracht ${f.id}`;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });

  // Niet vaker dan eens per 5 minuten.
  const { data: laatste } = await db.from("koppeling_log").select("tijdstip").eq("gelukt", true).order("tijdstip", { ascending: false }).limit(1).maybeSingle();
  if (laatste && Date.now() - new Date(laatste.tijdstip).getTime() < MIN_INTERVAL_MS) {
    return json({ overgeslagen: true, reden: "Minder dan 5 minuten geleden bijgewerkt" });
  }

  try {
    const [flex, relaties] = await Promise.all([
      haalAlles<FlexWorker>("/flex-workers", { include: "operating_company,labels" }),
      haalAlles<Relatie>("/relations", { include: "visiting_address" }),
    ]);
    const nu = new Date().toISOString();

    // Medewerkers
    const mwRijen = flex.map((f) => {
      const iso = (f.nationality_iso ?? "").toUpperCase();
      return {
        bron: "easyflex",
        ef_id: f.id,
        ef_registratienummer: f.easyflex_registration_number,
        naam: naamVan(f),
        nationaliteit: iso || null,
        groep: iso === "NL" || iso === "" ? "nl" : "int",
        bv: f.operating_company?.name ?? null,
        ef_status: STATUS[f.flex_worker_state] ?? String(f.flex_worker_state),
        certificaten: (f.labels ?? []).map((l) => l.label_name).filter(Boolean),
        actief: !f.deleted_at && (f.flex_worker_state === 1 || f.flex_worker_state === 2),
        laatst_gesynchroniseerd: nu,
      };
    });
    for (let i = 0; i < mwRijen.length; i += 500) {
      const { error } = await db.from("medewerkers").upsert(mwRijen.slice(i, i + 500), { onConflict: "ef_id" });
      if (error) throw new Error("Opslaan medewerkers: " + error.message);
    }

    // Opdrachtgevers
    const ogRijen = relaties.map((r) => ({
      ef_relatie_id: r.id,
      naam: r.name,
      plaats: r.visiting_address?.city ?? null,
      actief: true,
      laatst_gesynchroniseerd: nu,
    }));
    for (let i = 0; i < ogRijen.length; i += 500) {
      const { error } = await db.from("opdrachtgevers").upsert(ogRijen.slice(i, i + 500), { onConflict: "ef_relatie_id" });
      if (error) throw new Error("Opslaan opdrachtgevers: " + error.message);
    }

    // Wie niet meer in Easyflex2go staat, wordt inactief (niet verwijderd: de planning blijft bewaard).
    await db.from("medewerkers").update({ actief: false }).eq("bron", "easyflex").gt("ef_id", 0).lt("laatst_gesynchroniseerd", nu);
    await db.from("opdrachtgevers").update({ actief: false }).gt("ef_relatie_id", 0).lt("laatst_gesynchroniseerd", nu);

    // Eerste echte synchronisatie: voorbeeldgegevens opruimen.
    let voorbeeldOpgeruimd = false;
    if (mwRijen.length > 0) {
      const { data: vbOg } = await db.from("opdrachtgevers").select("id").lt("ef_relatie_id", 0);
      const vbOgIds = (vbOg ?? []).map((o) => o.id);
      if (vbOgIds.length) await db.from("vakken").delete().in("opdrachtgever_id", vbOgIds);
      const { count } = await db.from("medewerkers").delete({ count: "exact" }).or("ef_id.lt.0,ef_status.eq.VOORBEELD");
      if (vbOgIds.length) await db.from("opdrachtgevers").delete().in("id", vbOgIds);
      voorbeeldOpgeruimd = (count ?? 0) > 0 || vbOgIds.length > 0;
    }

    await db.from("koppeling_log").insert({ gelukt: true, medewerkers_bijgewerkt: mwRijen.length, opdrachtgevers_bijgewerkt: ogRijen.length });
    return json({ gelukt: true, medewerkers: mwRijen.length, opdrachtgevers: ogRijen.length, voorbeeldOpgeruimd });
  } catch (e) {
    const fout = e instanceof Error ? e.message : String(e);
    await db.from("koppeling_log").insert({ gelukt: false, foutmelding: fout.slice(0, 500) });
    return json({ gelukt: false, fout }, 502);
  }
});
