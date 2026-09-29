"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GROEPEN, tijdstipNL } from "@/lib/planning";

type Mw = { id: string; naam: string; groep: string; bv: string | null; nationaliteit: string | null; certificaten: string[]; bron: string; ef_registratienummer: string | null; telefoon: string | null; actief: boolean };
type Og = { id: string; naam: string; plaats: string | null; korte_naam: string | null; actief: boolean; werkmaatschappijen: string[]; kvk_nummer: number | null };

const BVS = ["Solestus Shared Services B.V.", "Solestus Nederland B.V.", "Solestus Personeelsdiensten B.V.", "Solestus Payroll Solutions B.V."];

const Slot = () => (
  <span className="slot" title="Komt uit Easyflex2go">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
    Easyflex2go
  </span>
);

export default function Stamgegevens(p: { medewerkers: Mw[]; opdrachtgevers: Og[]; laatsteSync: { tijdstip: string; gelukt: boolean; foutmelding: string | null } | null; magWijzigen: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"mw" | "og">("mw");
  const [zoek, setZoek] = useState("");
  const [nieuw, setNieuw] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

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
          <thead><tr><th>Naam</th><th>Groep</th><th>Nationaliteit</th><th>BV</th><th>Certificaten</th><th>Bron</th></tr></thead>
          <tbody>
            {mws.map((m) => (
              <tr key={m.id} style={{ opacity: m.actief ? 1 : 0.5 }}>
                <td><strong>{m.naam}</strong>{m.ef_registratienummer && <div className="hint">Reg.nr. {m.ef_registratienummer}</div>}</td>
                <td>{groepLabel(m.groep)}{m.bron === "easyflex" && <div className="hint">volgt uit nationaliteit</div>}</td>
                <td>{m.nationaliteit ?? "–"}</td>
                <td>{m.bv ?? "–"}</td>
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
