"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MedewerkerPaneel, { type MwStam } from "./MedewerkerPaneel";
import OpdrachtgeverPaneel, { type OgStam } from "./OpdrachtgeverPaneel";
import Icoon from "@/components/Icoon";
import Toast, { useToast } from "@/components/Toast";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import { leidVasteInzetAf } from "@/lib/afleiden";
import { createClient } from "@/lib/supabase/client";
import { logWijziging } from "@/lib/wijzigingen";
import { GROEPEN, geldigeVasteInzet, opdrachtgeverLabel, plusDagen, vasteInzetLabel, type Vak, type VasteInzet } from "@/lib/planning";
import { wanneer } from "@/lib/tijd";
import { VAK_KOLOMMEN } from "@/lib/laden";

type Mw = MwStam;
type Og = OgStam;
type Sync = { tijdstip: string; gelukt: boolean; foutmelding: string | null; medewerkers_bijgewerkt?: number };

const BVS = ["Solestus Shared Services B.V.", "Solestus Nederland B.V.", "Solestus Personeelsdiensten B.V.", "Solestus Payroll Solutions B.V."];

export default function Stamgegevens(p: {
  medewerkers: Mw[]; opdrachtgevers: Og[]; laatsteSync: Sync | null; laatstGelukt: Omit<Sync, "gelukt" | "foutmelding"> | null;
  week: number; maandag: string; diensten: Record<string, number>; openMedewerker: string | null; magWijzigen: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [zoek, setZoek] = useState("");
  const [nieuw, setNieuw] = useState(false);
  const [bewerk, setBewerk] = useState<Mw | null>(() => (p.magWijzigen && p.openMedewerker ? p.medewerkers.find((m) => m.id === p.openMedewerker) ?? null : null));
  const [bewerkOg, setBewerkOg] = useState<Og | "nieuw" | null>(null);
  const [afleiden, setAfleiden] = useState(false);
  const [bijwerken, setBijwerken] = useState(false);
  const { melding, toon, sluit } = useToast();
  const [ookInactief, setOokInactief] = useState(false);
  const [ookVerborgen, setOokVerborgen] = useState(false);
  const ogMap = useMemo(() => new Map(p.opdrachtgevers.map((o) => [o.id, o])), [p.opdrachtgevers]);


  async function nuBijwerken() {
    setBijwerken(true);
    const { data, error } = await supabase.functions.invoke("easyflex-sync", { body: {} });
    let uit = data as { gelukt?: boolean; overgeslagen?: boolean; fout?: string; medewerkers?: number } | null;
    if (error && "context" in error) uit = await (error.context as Response).json().catch(() => null);
    setBijwerken(false);
    if (uit?.overgeslagen) toon("Minder dan 5 minuten geleden al bijgewerkt. Probeer het zo nog eens.");
    else if (uit?.gelukt) { toon(`Bijgewerkt: ${uit.medewerkers ?? "?"} medewerkers`); router.refresh(); }
    else { toon(`Bijwerken lukte niet: ${uit?.fout ?? error?.message ?? "onbekende fout"}`, true); router.refresh(); }
  }

  const q = zoek.trim().toLowerCase();
  const zichtbaar = (m: Mw) => m.actief && !m.verborgen;
  const actief = p.medewerkers.filter(zichtbaar);
  const verborgenAantal = p.medewerkers.filter((m) => m.actief && m.verborgen).length;
  const mws = p.medewerkers.filter((m) => (ookInactief || zichtbaar(m)) && (!q || m.naam.toLowerCase().includes(q) || (m.ef_registratienummer ?? "").toLowerCase().includes(q)));
  const kiesbaar = p.opdrachtgevers.filter((o) => !o.verborgen);
  const ogs = p.opdrachtgevers.filter((o) => (ookVerborgen || !o.verborgen) && (!q || o.naam.toLowerCase().includes(q) || (o.korte_naam ?? "").toLowerCase().includes(q) || (o.plaats ?? "").toLowerCase().includes(q)));

  const sync = p.laatsteSync;
  const mislukt = sync && !sync.gelukt;
  const ok = p.laatstGelukt;
  const efAantal = actief.filter((m) => m.bron === "easyflex").length;

  const klikbaar = (open: () => void) => p.magWijzigen
    ? { className: "klikbaar", tabIndex: 0, onClick: open, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") open(); } }
    : {};

  return (
    <main className="pagina">
      <div className="kop">
        <div>
          <div className="kop-titel"><h1 className="machina">Stamgegevens</h1></div>
          <div className="kop-meta">Chauffeurs komen uit Easyflex2go; kantoormedewerkers en opdrachtgevers voeg je hier zelf toe.</div>
        </div>
        <label className="zoekveld">
          <Icoon naam="zoek" />
          <input type="search" aria-label="Zoeken" placeholder="Zoek op naam, plaats of Easyflex-nummer" value={zoek} onChange={(e) => setZoek(e.target.value)} />
        </label>
      </div>

      <section className={`koppeling${mislukt ? " mislukt" : ""}`} role="status">
        <span className="koppeling-icoon"><Icoon naam={mislukt ? "waarschuwing" : "sync"} maat={20} /></span>
        <div>
          <b>{mislukt ? "Bijwerken uit Easyflex2go is mislukt" : sync ? "Gekoppeld met Easyflex2go" : "Koppeling met Easyflex2go"}</b>
          <span>
            {mislukt
              ? `${ok ? `Laatst gelukt: ${wanneer(ok.tijdstip)}.` : "Het is nog niet eerder gelukt."} Nieuwe medewerkers of wijzigingen van vandaag staan er mogelijk nog niet in.${sync?.foutmelding ? ` (${sync.foutmelding})` : ""}`
              : ok
                ? `Medewerkers laatst bijgewerkt ${wanneer(ok.tijdstip)} · ${ok.medewerkers_bijgewerkt ?? "?"} medewerkers. Wijzigingen aan chauffeurs doe je in Easyflex2go.`
                : "Nog niet bijgewerkt. Klik op Nu bijwerken om de medewerkers uit Easyflex2go op te halen."}
          </span>
        </div>
        {p.magWijzigen && (
          <button type="button" className={`knop${mislukt ? " knop-fout" : ""}`} onClick={nuBijwerken} disabled={bijwerken}>
            {bijwerken ? "Bezig met bijwerken…" : mislukt ? "Opnieuw proberen" : "Nu bijwerken"}
          </button>
        )}
      </section>

      <section className="kaart stam-kaart" aria-labelledby="h-mw">
        <div className="stam-kop">
          <h2 id="h-mw">Medewerkers</h2>
          <span>{actief.length} actief · {efAantal} uit Easyflex2go · {actief.length - efAantal} handmatig{verborgenAantal ? ` · ${verborgenAantal} verborgen` : ""}</span>
          <div style={{ flexGrow: 1 }} />
          <label className="vink" style={{ fontSize: 13 }}><input type="checkbox" checked={ookInactief} onChange={(e) => setOokInactief(e.target.checked)} />Ook niet-actieve en verborgen</label>
          {p.magWijzigen && <button type="button" className="knop" onClick={() => setAfleiden(true)}>Vaste inzet afleiden</button>}
          {p.magWijzigen && <button type="button" className="knop knop-zwart" onClick={() => setNieuw(true)}><Icoon naam="plus" />Kantoormedewerker toevoegen</button>}
        </div>
        <table className="tabel">
          <thead><tr><th>Naam</th><th>Easyflex-nr</th><th>Nat.</th><th>BV</th><th>Vaste inzet</th><th>Certificaten</th><th>Telefoon</th><th aria-label="Acties" /></tr></thead>
          <tbody>
            {GROEPEN.map((g) => {
              const lijst = mws.filter((m) => m.groep === g.id);
              if (!lijst.length) return null;
              return [
                <tr key={g.id} className="groep"><td colSpan={8}><span><span className="bolletje" />{g.label}</span></td></tr>,
                ...lijst.map((m) => (
                  <tr key={m.id} style={{ opacity: zichtbaar(m) ? 1 : 0.5 }} {...klikbaar(() => setBewerk(m))}>
                    <td><strong>{m.naam}</strong>{!m.actief ? <div className="hint">niet actief{m.ef_status ? ` (${m.ef_status.toLowerCase()})` : ""}</div> : m.verborgen && <div className="hint">verborgen in de planning</div>}</td>
                    <td>{m.bron === "easyflex" ? <span className="nr">{m.ef_registratienummer ?? "–"} <span className="bron-ef">EF2GO</span></span> : <span className="bron-hand">handmatig</span>}</td>
                    <td>{m.nationaliteit ?? "–"}</td>
                    <td>{m.werkmaatschappijen.length > 1 ? `${m.werkmaatschappijen.length} werkmaatschappijen` : m.bv ?? "–"}</td>
                    <td>{vasteInzetLabel(m.vaste_inzet, ogMap)}</td>
                    <td><span className="labels" style={{ padding: 0 }}>{m.certificaten.map((c) => <span key={c} className={`label${/ADR/.test(c) ? " label-adr" : ""}`}>{c}</span>)}</span></td>
                    <td>{m.telefoon ?? ""}</td>
                    <td className="getal">{p.magWijzigen && <span className="knop-link" style={{ height: "auto" }}>Bewerken</span>}</td>
                  </tr>
                )),
              ];
            })}
            {mws.length === 0 && <tr><td colSpan={8}>Geen medewerkers gevonden.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="kaart stam-kaart" aria-labelledby="h-og">
        <div className="stam-kop">
          <h2 id="h-og">Opdrachtgevers</h2>
          <span>{kiesbaar.length} actief{p.opdrachtgevers.length > kiesbaar.length ? ` · ${p.opdrachtgevers.length - kiesbaar.length} verborgen` : ""}</span>
          <div style={{ flexGrow: 1 }} />
          <label className="vink" style={{ fontSize: 13 }}><input type="checkbox" checked={ookVerborgen} onChange={(e) => setOokVerborgen(e.target.checked)} />Ook verborgen</label>
          {p.magWijzigen && <button type="button" className="knop knop-zwart" onClick={() => setBewerkOg("nieuw")}><Icoon naam="plus" />Opdrachtgever toevoegen</button>}
        </div>
        <table className="tabel">
          <thead><tr><th>Naam</th><th>Plaats</th><th>In het rooster</th><th className="getal">Diensten wk {p.week}</th><th aria-label="Acties" /></tr></thead>
          <tbody>
            {ogs.map((o) => (
              <tr key={o.id} style={{ opacity: o.verborgen ? 0.5 : 1 }} {...klikbaar(() => setBewerkOg(o))}>
                <td>
                  <strong>{o.naam}</strong>
                  {o.scania && <div className="hint">Scania-ritten</div>}
                  {o.verborgen && <div className="hint">verborgen in de planning</div>}
                </td>
                <td>{o.plaats ?? "–"}</td>
                <td>{opdrachtgeverLabel(o)}</td>
                <td className="getal"><strong>{p.diensten[o.id] ?? 0}</strong></td>
                <td className="getal">{p.magWijzigen && <span className="knop-link" style={{ height: "auto" }}>Bewerken</span>}</td>
              </tr>
            ))}
            {ogs.length === 0 && <tr><td colSpan={5}>{p.opdrachtgevers.length ? "Geen opdrachtgevers gevonden." : "Nog geen opdrachtgevers. Voeg de eerste toe met ‘Opdrachtgever toevoegen’."}</td></tr>}
          </tbody>
        </table>
      </section>

      {bewerk && (
        <MedewerkerPaneel
          key={bewerk.id}
          mw={bewerk}
          opdrachtgevers={p.opdrachtgevers}
          bvs={BVS}
          onSluit={() => setBewerk(null)}
          onKlaar={(tekst, fout) => { if (!fout) { setBewerk(null); router.refresh(); } toon(tekst, fout); }}
        />
      )}
      {bewerkOg && (
        <OpdrachtgeverPaneel
          key={bewerkOg === "nieuw" ? "nieuw" : bewerkOg.id}
          og={bewerkOg === "nieuw" ? null : bewerkOg}
          anderScania={p.opdrachtgevers.find((o) => o.scania && (bewerkOg === "nieuw" || o.id !== bewerkOg.id))?.naam ?? null}
          onSluit={() => setBewerkOg(null)}
          onKlaar={(tekst, fout) => { if (!fout) { setBewerkOg(null); router.refresh(); } toon(tekst, fout); }}
        />
      )}
      {nieuw && <KantoorToevoegen onSluit={() => setNieuw(false)} onKlaar={(t, fout) => { if (!fout) { setNieuw(false); router.refresh(); } toon(t, fout); }} />}
      {afleiden && (
        <VasteInzetAfleiden
          maandag={p.maandag}
          medewerkers={actief}
          opdrachtgevers={ogMap}
          onSluit={() => setAfleiden(false)}
          onKlaar={(t, fout) => { if (!fout) { setAfleiden(false); router.refresh(); } toon(t, fout); }}
        />
      )}
      <Toast melding={melding} sluit={sluit} />
    </main>
  );
}

function KantoorToevoegen({ onSluit, onKlaar }: { onSluit: () => void; onKlaar: (t: string, fout?: boolean) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [naam, setNaam] = useState("");
  const [bv, setBv] = useState(BVS[0]);
  const [telefoon, setTelefoon] = useState("");
  const [bezig, setBezig] = useState(false);

  async function voegToe() {
    if (!naam.trim()) return;
    setBezig(true);
    const { error } = await supabase.from("medewerkers").insert({ bron: "handmatig", groep: "kantoor", naam: naam.trim(), bv, telefoon: telefoon.trim() || null, nationaliteit: null, volgorde: 1000 });
    setBezig(false);
    if (error) { onKlaar("Toevoegen lukte niet: " + error.message, true); return; }
    await logWijziging(supabase, "medewerkers", `Kantoormedewerker ${naam.trim()} toegevoegd`);
    onKlaar(`${naam.trim()} toegevoegd`);
  }

  return (
    <PaneelSchil boven="Stamgegevens" titel="Kantoormedewerker toevoegen" sub="kantoor" onSluit={onSluit}
      voet={<PaneelVoet opslaan={voegToe} opslaanLabel="Toevoegen" uit={!naam.trim() || bezig} onAnnuleren={onSluit} />}>
      <p className="infoblok">Chauffeurs komen automatisch uit Easyflex2go. Hier voeg je alleen kantoormedewerkers toe.</p>
      <div className="veld"><label className="veld-kop" htmlFor="kt-naam">Naam</label><input id="kt-naam" className="invoer" value={naam} onChange={(e) => setNaam(e.target.value)} autoFocus /></div>
      <div className="veld"><label className="veld-kop" htmlFor="kt-bv">BV / contract</label><select id="kt-bv" className="invoer" value={bv} onChange={(e) => setBv(e.target.value)}>{BVS.map((b) => <option key={b}>{b}</option>)}</select></div>
      <div className="veld"><label className="veld-kop" htmlFor="kt-tel">Telefoon (optioneel)</label><input id="kt-tel" className="invoer" type="tel" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} /></div>
    </PaneelSchil>
  );
}

/** Stelt per medewerker een vaste inzet voor op basis van de afgelopen vier weken. */
function VasteInzetAfleiden({ maandag, medewerkers, opdrachtgevers, onSluit, onKlaar }: {
  maandag: string; medewerkers: Mw[]; opdrachtgevers: Map<string, Og>; onSluit: () => void; onKlaar: (t: string, fout?: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [voorstel, setVoorstel] = useState<[Mw, VasteInzet][] | null>(null);
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    supabase.from("vakken").select(VAK_KOLOMMEN).gte("datum", plusDagen(maandag, -28)).lt("datum", maandag)
      .then(({ data, error }) => {
        if (error) { onKlaar("De planning van de afgelopen weken kon niet worden geladen.", true); return; }
        const afgeleid = leidVasteInzetAf((data ?? []) as Vak[]);
        const lijst = medewerkers.filter((m) => afgeleid.has(m.id) && vasteInzetLabel(m.vaste_inzet, opdrachtgevers) !== vasteInzetLabel(afgeleid.get(m.id), opdrachtgevers))
          .map((m) => [m, afgeleid.get(m.id)!] as [Mw, VasteInzet]);
        setVoorstel(lijst);
        setGekozen(new Set(lijst.filter(([m]) => !geldigeVasteInzet(m.vaste_inzet)).map(([m]) => m.id)));
      });
    // Eenmalig bij openen van het paneel.
  }, []);

  async function toepassen() {
    if (!voorstel) return;
    setBezig(true);
    const kies = voorstel.filter(([m]) => gekozen.has(m.id));
    for (const [m, v] of kies) {
      const { error } = await supabase.from("medewerkers").update({ vaste_inzet: v }).eq("id", m.id);
      if (error) { setBezig(false); onKlaar(`Opslaan lukte niet bij ${m.naam}.`, true); return; }
    }
    if (kies.length) await logWijziging(supabase, "medewerkers", `Vaste inzet afgeleid voor ${kies.length} medewerkers`);
    setBezig(false);
    onKlaar(`Vaste inzet ingesteld voor ${kies.length} medewerkers`);
  }

  return (
    <PaneelSchil boven="Stamgegevens" titel="Vaste inzet afleiden" sub="uit de afgelopen vier weken" onSluit={onSluit}
      voet={<PaneelVoet opslaan={toepassen} opslaanLabel={`Toepassen (${gekozen.size})`} uit={!gekozen.size || bezig} onAnnuleren={onSluit} />}>
      <p className="infoblok">Wie in de afgelopen vier weken op dezelfde weekdag minstens drie keer hetzelfde deed, krijgt dat als voorstel. Vink aan wat je wilt overnemen; bestaande vaste inzet wordt dan vervangen.</p>
      {voorstel === null && <p style={{ margin: 0 }}>Planning van de afgelopen weken bekijken…</p>}
      {voorstel?.length === 0 && <p style={{ margin: 0 }}>Geen nieuw patroon gevonden. Iedereen heeft al de vaste inzet die bij de planning past, of er is te weinig gepland.</p>}
      {voorstel && voorstel.length > 0 && (
        <div className="stapel-8">
          {voorstel.map(([m, v]) => (
            <label key={m.id} className="vink afleid-rij">
              <input type="checkbox" checked={gekozen.has(m.id)} onChange={(e) => { const n = new Set(gekozen); if (e.target.checked) n.add(m.id); else n.delete(m.id); setGekozen(n); }} />
              <span><b>{m.naam}</b><br />{vasteInzetLabel(v, opdrachtgevers)}{geldigeVasteInzet(m.vaste_inzet) && <small> (nu: {vasteInzetLabel(m.vaste_inzet, opdrachtgevers)})</small>}</span>
            </label>
          ))}
        </div>
      )}
    </PaneelSchil>
  );
}
