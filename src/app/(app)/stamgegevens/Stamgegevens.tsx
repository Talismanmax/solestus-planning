"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MedewerkerPaneel, { type MwStam } from "./MedewerkerPaneel";
import { GROEPEN, tijdstipNL, vasteInzetLabel } from "@/lib/planning";

type Mw = MwStam;
type Og = { id: string; naam: string; plaats: string | null; korte_naam: string | null; actief: boolean; werkmaatschappijen: string[]; kvk_nummer: number | null };

const BVS = ["Solestus Shared Services B.V.", "Solestus Nederland B.V.", "Solestus Personeelsdiensten B.V.", "Solestus Payroll Solutions B.V."];

const Slot = () => (
  <span className="slot" title="Komt uit Easyflex2go">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
    Easyflex2go
  </span>
);

export default function Stamgegevens(p: { medewerkers: Mw[]; opdrachtgevers: Og[]; laatsteSync: { tijdstip: string; gelukt: boolean; foutmelding: string | null; medewerkers_bijgewerkt?: number; opdrachtgevers_bijgewerkt?: number } | null; magWijzigen: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"mw" | "og">("mw");
  const [zoek, setZoek] = useState("");
  const [nieuw, setNieuw] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bewerk, setBewerk] = useState<Mw | null>(null);
  const [bijwerken, setBijwerken] = useState(false);
  const [toast, setToast] = useState<{ tekst: string; fout?: boolean } | null>(null);

  function toon(tekst: string, fout = false) {
    setToast({ tekst, fout });
    setTimeout(() => setToast(null), fout ? 8000 : 4000);
  }

  async function nuBijwerken() {
    setBijwerken(true);
    const { data, error } = await supabase.functions.invoke("easyflex-sync", { body: {} });
    let uit = data as { gelukt?: boolean; overgeslagen?: boolean; fout?: string; medewerkers?: number; opdrachtgevers?: number } | null;
    if (error && "context" in error) uit = await (error.context as Response).json().catch(() => null);
    setBijwerken(false);
    if (uit?.overgeslagen) toon("Minder dan 5 minuten geleden al bijgewerkt. Probeer het zo nog eens.");
    else if (uit?.gelukt) { toon(`Bijgewerkt: ${uit.medewerkers ?? "?"} medewerkers en ${uit.opdrachtgevers ?? "?"} opdrachtgevers`); router.refresh(); }
    else { toon(`Bijwerken is niet gelukt: ${uit?.fout ?? error?.message ?? "onbekende fout"}`, true); router.refresh(); }
  }
  const ogMap = useMemo(() => new Map(p.opdrachtgevers.map((o) => [o.id, o])), [p.opdrachtgevers]);

  const groepLabel = (g: string) => GROEPEN.find((x) => x.id === g)?.label ?? g;
  const mws = p.medewerkers.filter((m) => !zoek || m.naam.toLowerCase().includes(zoek.toLowerCase()));
  const ogs = p.opdrachtgevers.filter((o) => !zoek || o.naam.toLowerCase().includes(zoek.toLowerCase()));

  async function voegToe(form: FormData) {
    setFout(null);
    const naam = String(form.get("naam") ?? "").trim();
    if (!naam) { setFout("Vul een naam in."); return; }
    const { error } = await supabase.from("medewerkers").insert({
      bron: "handmatig", groep: "kantoor", naam,
      bv: String(form.get("bv") || "") || null,
      telefoon: String(form.get("telefoon") || "") || null,
      nationaliteit: null, volgorde: 1000,
    });
    if (error) { setFout("Toevoegen is niet gelukt: " + error.message); return; }
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from("wijzigingen").insert({ gebruiker_id: data.user.id, omschrijving: `Kantoormedewerker ${naam} toegevoegd`, tabel: "medewerkers" });
    setNieuw(false);
    router.refresh();
  }

  const sync = p.laatsteSync;
  return (
    <main className="pagina">
      <div className="kop">
        <div>
          <h1 className="machina">Stamgegevens</h1>
          <div className="kop-meta">Medewerkers en opdrachtgevers. Easyflex2go is leidend: gegevens met een slotje pas je daar aan.</div>
        </div>
        {p.magWijzigen && tab === "mw" && <button type="button" className="knop knop-zwart" onClick={() => setNieuw(true)}>Kantoormedewerker toevoegen</button>}
      </div>

      <div className="sync" role="status">
        <strong>Koppeling Easyflex2go</strong>
        {sync
          ? <span>{sync.gelukt ? "Laatst bijgewerkt" : "Laatste poging mislukt"} · {tijdstipNL(sync.tijdstip)}{sync.foutmelding ? ` · ${sync.foutmelding}` : ""}</span>
          : <span>Nog niet ingesteld. Tot de koppeling draait, staan hier voorbeeldgegevens.</span>}
        {sync?.gelukt && sync.medewerkers_bijgewerkt != null && <span className="hint">{sync.medewerkers_bijgewerkt} medewerkers · {sync.opdrachtgevers_bijgewerkt} opdrachtgevers · elk uur (ma–za)</span>}
        <div style={{ flexGrow: 1 }} />
        {p.magWijzigen && <button type="button" className="knop knop-rand" onClick={nuBijwerken} disabled={bijwerken}>{bijwerken ? "Bezig met bijwerken…" : "Nu bijwerken"}</button>}
      </div>

      <div className="werkbalk">
        <div className="seg" role="group" aria-label="Soort">
          <button type="button" aria-pressed={tab === "mw"} onClick={() => setTab("mw")}>Medewerkers · {p.medewerkers.length}</button>
          <button type="button" aria-pressed={tab === "og"} onClick={() => setTab("og")}>Opdrachtgevers · {p.opdrachtgevers.length}</button>
        </div>
        <input className="zoek" type="search" placeholder="Zoeken" aria-label="Zoeken" value={zoek} onChange={(e) => setZoek(e.target.value)} />
      </div>

      {tab === "mw" ? (
        <table className="tabel">
          <thead><tr><th>Naam</th><th>Groep</th><th>Nationaliteit</th><th>BV</th><th>Vaste inzet</th><th>Certificaten</th><th>Bron</th></tr></thead>
          <tbody>
            {mws.map((m) => (
              <tr key={m.id} style={{ opacity: m.actief ? 1 : 0.5 }} className={p.magWijzigen ? "klikbaar" : undefined}
                onClick={p.magWijzigen ? () => setBewerk(m) : undefined}
                onKeyDown={p.magWijzigen ? (e) => { if (e.key === "Enter") setBewerk(m); } : undefined}
                tabIndex={p.magWijzigen ? 0 : undefined}>
                <td><strong>{m.naam}</strong>{m.telefoon && <div className="hint">{m.telefoon}</div>}{m.ef_registratienummer && <div className="hint">Reg.nr. {m.ef_registratienummer}</div>}</td>
                <td>{groepLabel(m.groep)}{m.bron === "easyflex" && <div className="hint">volgt uit nationaliteit</div>}</td>
                <td>{m.nationaliteit ?? "–"}</td>
                <td>{m.werkmaatschappijen.length > 1 ? m.werkmaatschappijen.join(", ") : m.bv ?? "–"}{m.werkmaatschappijen.length > 1 && <div className="hint">actief bij {m.werkmaatschappijen.length} werkmaatschappijen</div>}</td>
                <td>{vasteInzetLabel(m.vaste_inzet, ogMap)}</td>
                <td>{m.certificaten.join(", ") || "–"}</td>
                <td>{m.bron === "easyflex" ? <Slot /> : "Handmatig"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="tabel">
          <thead><tr><th>Naam</th><th>Plaats</th><th>KvK</th><th>Werkmaatschappijen</th><th>Bron</th></tr></thead>
          <tbody>
            {ogs.map((o) => (
              <tr key={o.id}><td><strong>{o.naam}</strong></td><td>{o.plaats ?? "–"}</td><td>{o.kvk_nummer ?? "–"}</td><td>{o.werkmaatschappijen.map((w) => w.replace(/^Solestus /, "").replace(/ B\.V\.$/, "")).join(", ") || "–"}{o.werkmaatschappijen.length > 1 && <div className="hint">samengevoegd uit {o.werkmaatschappijen.length} relaties</div>}</td><td><Slot /></td></tr>
            ))}
          </tbody>
        </table>
      )}

      {bewerk && (
        <MedewerkerPaneel
          key={bewerk.id}
          mw={bewerk}
          opdrachtgevers={p.opdrachtgevers}
          bvs={BVS}
          onSluit={() => setBewerk(null)}
          onKlaar={(tekst, fout) => {
            if (!fout) { setBewerk(null); router.refresh(); }
            setToast({ tekst, fout });
            setTimeout(() => setToast(null), fout ? 6000 : 2500);
          }}
        />
      )}
      {toast && <div className={`toast${toast.fout ? " fout" : ""}`} role="status">{toast.tekst}</div>}

      {nieuw && (
        <>
          <div className="paneel-achter" onClick={() => setNieuw(false)} />
          <aside className="paneel" role="dialog" aria-label="Kantoormedewerker toevoegen">
            <form action={voegToe} style={{ display: "contents" }}>
              <div className="paneel-kop"><div><div style={{ fontSize: 13 }}>Stamgegevens</div><h2 className="machina">Kantoormedewerker toevoegen</h2></div></div>
              <div className="paneel-inhoud">
                <div className="melding" style={{ maxWidth: "none" }}>Chauffeurs komen automatisch uit Easyflex2go. Hier voeg je alleen kantoormedewerkers toe.</div>
                <label className="veld"><span>Naam</span><input className="invoer" name="naam" required autoFocus /></label>
                <label className="veld"><span>BV</span><select className="invoer" name="bv" defaultValue={BVS[0]}>{BVS.map((b) => <option key={b}>{b}</option>)}</select></label>
                <label className="veld"><span>Telefoon (optioneel)</span><input className="invoer" name="telefoon" type="tel" /></label>
                {fout && <div className="melding melding-fout" role="alert">{fout}</div>}
              </div>
              <div className="paneel-voet">
                <button type="button" className="knop" onClick={() => setNieuw(false)}>Annuleren</button>
                <button type="submit" className="knop knop-zwart">Toevoegen</button>
              </div>
            </form>
          </aside>
        </>
      )}
    </main>
  );
}
