"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import "./scania.css";
import { createClient } from "@/lib/supabase/client";
import { STATUS, dagInfo, plusDagen, weekBereik, weekParam, type Afwezigheid, type Vak } from "@/lib/planning";
import { ROUTE_KORT, ROUTE_NAAM, RUST_UREN, afwezigOp, deelRegel, einde, ritTekst, ritWaarschuwingen, rustVoor, standaardDelen, type Chauffeur, type Dienst, type Rit, type RitDeel, type Route } from "@/lib/scania";
import { naarIso, naarLokaal } from "@/lib/tijd";

type Props = {
  week: number; maandag: string; ritten: Rit[]; chauffeurs: Chauffeur[]; scaniaId: string | null;
  afwezigheid: Afwezigheid[]; vakken: Vak[]; magWijzigen: boolean; laadFout: string | null;
};

export default function Scania(p: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [bewerk, setBewerk] = useState<Rit | "nieuw" | null>(null);
  const [menu, setMenu] = useState<"vullen" | "export" | null>(null);
  const [tekst, setTekst] = useState<string | null>(null);
  const [melding, setMelding] = useState<{ t: string; fout?: boolean } | null>(null);
  const [bezig, setBezig] = useState(false);

  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(p.maandag, i));
  const zondag = dagen[6];
  const naam = useMemo(() => new Map(p.chauffeurs.map((c) => [c.id, c.naam])), [p.chauffeurs]);
  const inWeek = p.ritten.filter((r) => r.vertrekdatum >= p.maandag && r.vertrekdatum <= zondag);

  function toon(t: string, fout = false) { setMelding({ t, fout }); setTimeout(() => setMelding(null), fout ? 6000 : 2500); }

  const afwezig = (mwId: string, datum: string) => afwezigOp(mwId, datum, p.afwezigheid, p.vakken);
  const waarschuwingen = (r: Rit) => ritWaarschuwingen(r, p.ritten, naam, p.afwezigheid, p.vakken);

  async function vorigeWeekKopieren() {
    setMenu(null);
    if (inWeek.length && !confirm(`Deze week heeft al ${inWeek.length} rit(ten). Ritten van vorige week toevoegen?`)) return;
    setBezig(true);
    const { data, error } = await supabase.from("scania_ritten").select("vertrekdatum, dienst, route, chauffeur_id, notitie, rit_delen(volgorde, van, naar, vertrek, aankomst)")
      .gte("vertrekdatum", plusDagen(p.maandag, -7)).lte("vertrekdatum", plusDagen(p.maandag, -1));
    if (error) { setBezig(false); toon("Kopiëren is niet gelukt.", true); return; }
    if (!data?.length) { setBezig(false); toon("Vorige week heeft geen ritten."); return; }
    const plus7 = (iso: string) => new Date(new Date(iso).getTime() + 7 * 86400000).toISOString();
    for (const r of data as Omit<Rit, "id">[]) {
      const { data: nieuw, error: e1 } = await supabase.from("scania_ritten").insert({ vertrekdatum: plusDagen(r.vertrekdatum, 7), dienst: r.dienst, route: r.route, chauffeur_id: r.chauffeur_id, notitie: null }).select("id").single();
      if (e1 || !nieuw) { setBezig(false); toon("Kopiëren is deels mislukt.", true); router.refresh(); return; }
      const delen = r.rit_delen.map((d) => ({ rit_id: nieuw.id, volgorde: d.volgorde, van: d.van, naar: d.naar, vertrek: plus7(d.vertrek), aankomst: plus7(d.aankomst) }));
      if (delen.length) await supabase.from("rit_delen").insert(delen);
    }
    await log(`Scania-ritten van week ${p.week - 1} gekopieerd naar week ${p.week}`);
    setBezig(false);
    toon(`${data.length} rit(ten) gekopieerd`);
    router.refresh();
  }

  async function log(omschrijving: string, recordId?: string) {
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from("wijzigingen").insert({ gebruiker_id: data.user.id, omschrijving, tabel: "scania_ritten", record_id: recordId ?? null });
  }

  function exportTekst() {
    setMenu(null);
    const per = new Map<string, Rit[]>();
    const open: Rit[] = [];
    for (const r of [...inWeek].sort((a, b) => (a.rit_delen[0]?.vertrek ?? "").localeCompare(b.rit_delen[0]?.vertrek ?? ""))) {
      if (!r.chauffeur_id) { open.push(r); continue; }
      per.set(r.chauffeur_id, [...(per.get(r.chauffeur_id) ?? []), r]);
    }
    const blokken = [...per.entries()].map(([id, rs]) => `${naam.get(id) ?? "Onbekend"}\n${rs.map(ritTekst).join("\n")}`);
    if (open.length) blokken.push(`Nog geen chauffeur\n${open.map(ritTekst).join("\n")}`);
    setTekst(`Scania-ritten week ${p.week} (${weekBereik(p.maandag)})\n\n${blokken.join("\n\n") || "Geen ritten gepland."}`);
  }

  const vorige = weekParam(plusDagen(p.maandag, -7)), volgende = weekParam(plusDagen(p.maandag, 7));
  const openAantal = inWeek.filter((r) => !r.chauffeur_id).length;

  return (
    <main className="pagina">
      <div className="kop">
        <div>
          <h1 className="machina">Scania-ritten <span style={{ fontFamily: "Fustat", fontWeight: 400, fontSize: 18 }}>week {p.week} · {weekBereik(p.maandag)}</span></h1>
          <div className="kop-meta">Manpower / Scania · Zwolle{openAantal > 0 && <> · <strong>{openAantal} rit{openAantal > 1 ? "ten" : ""} zonder chauffeur</strong></>}</div>
        </div>
        <div className="weekkiezer">
          <Link className="icoonknop" href={`/scania?week=${vorige}`} aria-label="Vorige week"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></Link>
          <Link className="knop" href="/scania">Deze week</Link>
          <Link className="icoonknop" href={`/scania?week=${volgende}`} aria-label="Volgende week"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></Link>
        </div>
      </div>

      {p.laadFout && <div className="melding melding-fout" role="alert" style={{ maxWidth: "none", marginBottom: 14 }}><strong>Laden is niet gelukt</strong>{p.laadFout}</div>}
      {!p.scaniaId && <div className="voorbeeld">Opdrachtgever Scania (Easyflex2go-relatie “Manpower AB”) is niet gevonden in de stamgegevens. Ritten worden wel opgeslagen, maar niet in de weekplanning gezet.</div>}

      <div className="werkbalk">
        <div style={{ flexGrow: 1 }} />
        {p.magWijzigen && (
          <div className="menu-anker">
            <button type="button" className="knop" aria-expanded={menu === "vullen"} onClick={() => setMenu(menu === "vullen" ? null : "vullen")} disabled={bezig}>Week vullen ▾</button>
            {menu === "vullen" && (
              <div className="menu" role="menu" style={{ top: 48 }}>
                <button type="button" role="menuitem" className="menu-item" onClick={vorigeWeekKopieren}>Vorige week kopiëren</button>
                <button type="button" role="menuitem" className="menu-item" disabled title="De standaardweek wordt nog vastgesteld">Standaardweek invullen (volgt)</button>
              </div>
            )}
          </div>
        )}
        <div className="menu-anker">
          <button type="button" className="knop" aria-expanded={menu === "export"} onClick={() => setMenu(menu === "export" ? null : "export")}>Exporteren ▾</button>
          {menu === "export" && (
            <div className="menu" role="menu" style={{ top: 48 }}>
              <button type="button" role="menuitem" className="menu-item" onClick={exportTekst}>Ritten als tekst</button>
              <a role="menuitem" className="menu-item" href={`/afdruk/scania?week=${weekParam(p.maandag)}`} target="_blank" rel="noopener" onClick={() => setMenu(null)} style={{ textDecoration: "none" }}>PDF, A4 liggend</a>
            </div>
          )}
        </div>
        {p.magWijzigen && <button type="button" className="knop knop-zwart" onClick={() => setBewerk("nieuw")}>Rit toevoegen</button>}
      </div>

      <div className="ritten">
        <div className="rit-kop"><span>Dag</span><span>Dienst</span><span>Route</span><span>Heen</span><span>Terug</span><span>Chauffeur</span></div>
        {dagen.map((d, i) => {
          const rs = inWeek.filter((r) => r.vertrekdatum === d).sort((a, b) => (a.rit_delen[0]?.vertrek ?? "").localeCompare(b.rit_delen[0]?.vertrek ?? ""));
          const info = dagInfo(d, i);
          if (!rs.length) return <div key={d} className="rit-rij rit-leeg"><span className="rit-dag">{info.kort} {info.nummer} {info.maand}</span><span className="hint">Geen ritten</span></div>;
          return rs.map((r, k) => {
            const delen = [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde).map(deelRegel);
            const w = waarschuwingen(r);
            return (
              <button type="button" key={r.id} className={`rit-rij${k === 0 ? " rit-eerste" : ""}`} disabled={!p.magWijzigen} onClick={() => setBewerk(r)}
                aria-label={`Rit ${info.kort} ${info.nummer} ${info.maand}, ${r.dienst}, ${naam.get(r.chauffeur_id ?? "") ?? "nog geen chauffeur"}`}>
                <span className="rit-dag">{k === 0 ? `${info.kort} ${info.nummer} ${info.maand}` : ""}</span>
                <span><span className={`dienst dienst-${r.dienst}`}>{r.dienst === "dag" ? "Dag" : "Nacht"}</span></span>
                <span className="rit-route">{ROUTE_KORT[r.route]}</span>
                <span>{delen[0] ? <><strong>{delen[0].titel}</strong><small>{delen[0].tijden}</small></> : "–"}</span>
                <span>{delen[1] ? <><strong>{delen[1].titel}</strong><small>{delen[1].tijden}</small></> : r.route === "rade" ? <small>Swap in Rade</small> : "–"}</span>
                <span>
                  {r.chauffeur_id ? <strong>{naam.get(r.chauffeur_id) ?? "Onbekend"}</strong> : <span className="rit-open">Nog geen chauffeur</span>}
                  {w.map((t) => <small key={t} className="rit-let">{t}</small>)}
                  {r.notitie && <small>{r.notitie}</small>}
                </span>
              </button>
            );
          });
        })}
      </div>

      {bewerk && (
        <RitPaneel
          key={bewerk === "nieuw" ? "nieuw" : bewerk.id}
          rit={bewerk === "nieuw" ? null : bewerk}
          standaardDatum={dagen[0]}
          chauffeurs={p.chauffeurs}
          opScania={new Set(inWeek.map((r) => r.chauffeur_id).filter(Boolean) as string[])}
          afwezig={afwezig}
          alleRitten={p.ritten}
          onSluit={() => setBewerk(null)}
          onKlaar={(t) => { setBewerk(null); toon(t); router.refresh(); }}
          onFout={(t) => toon(t, true)}
          scaniaId={p.scaniaId}
          vakken={p.vakken}
        />
      )}

      {tekst !== null && (
        <>
          <div className="paneel-achter" style={{ inset: 0 }} onClick={() => setTekst(null)} />
          <div role="dialog" aria-label="Ritten als tekst" className="menu tekst-dialoog">
            <h2 className="machina" style={{ margin: 0, fontSize: 22 }}>Ritten als tekst</h2>
            <textarea className="invoer" readOnly value={tekst} rows={16} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="knop" onClick={() => setTekst(null)}>Sluiten</button>
              <button type="button" className="knop knop-zwart" onClick={async () => { await navigator.clipboard.writeText(tekst); toon("Gekopieerd"); }}>Kopiëren</button>
            </div>
          </div>
        </>
      )}
      {melding && <div className={`toast${melding.fout ? " fout" : ""}`} role="status">{melding.t}</div>}
    </main>
  );
}

function RitPaneel(props: {
  rit: Rit | null; standaardDatum: string; chauffeurs: Chauffeur[]; opScania: Set<string>;
  afwezig: (id: string, d: string) => string | null; alleRitten: Rit[]; scaniaId: string | null; vakken: Vak[];
  onSluit: () => void; onKlaar: (t: string) => void; onFout: (t: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const r = props.rit;
  const [datum, setDatum] = useState(r?.vertrekdatum ?? props.standaardDatum);
  const [dienst, setDienst] = useState<Dienst>(r?.dienst ?? "dag");
  const [route, setRoute] = useState<Route>(r?.route ?? "ishoj");
  const [delen, setDelen] = useState<RitDeel[]>(r ? [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde) : standaardDelen(props.standaardDatum, "dag", "ishoj"));
  const [chauffeur, setChauffeur] = useState(r?.chauffeur_id ?? "");
  const [notitie, setNotitie] = useState(r?.notitie ?? "");
  const [bezig, setBezig] = useState(false);

  function wijzig(d: string, di: Dienst, ro: Route) {
    setDatum(d); setDienst(di); setRoute(ro);
    setDelen(standaardDelen(d, di, ro));
  }

  const proef: Rit = { id: r?.id ?? "nieuw", vertrekdatum: datum, dienst, route, chauffeur_id: chauffeur || null, notitie, rit_delen: delen };
  const rust = chauffeur ? rustVoor(proef, props.alleRitten) : null;
  const afw = chauffeur ? props.afwezig(chauffeur, datum) : null;
  const tijdenFout = delen.some((d) => d.aankomst <= d.vertrek);

  async function opslaan() {
    if (tijdenFout) return;
    setBezig(true);
    const { data: auth } = await supabase.auth.getUser();
    const rij = { vertrekdatum: datum, dienst, route, chauffeur_id: chauffeur || null, notitie: notitie.trim() || null, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() };
    let id = r?.id;
    if (id) {
      const { error } = await supabase.from("scania_ritten").update(rij).eq("id", id);
      if (error) { setBezig(false); props.onFout("Opslaan is niet gelukt."); return; }
      await supabase.from("rit_delen").delete().eq("rit_id", id);
    } else {
      const { data, error } = await supabase.from("scania_ritten").insert(rij).select("id").single();
      if (error || !data) { setBezig(false); props.onFout("Opslaan is niet gelukt."); return; }
      id = data.id;
    }
    const { error: e2 } = await supabase.from("rit_delen").insert(delen.map((d, i) => ({ rit_id: id, volgorde: i + 1, van: d.van, naar: d.naar, vertrek: d.vertrek, aankomst: d.aankomst })));
    if (e2) { setBezig(false); props.onFout("De tijden zijn niet opgeslagen."); return; }

    if (chauffeur && props.scaniaId) {
      const bestaand = props.vakken.find((v) => v.medewerker_id === chauffeur && v.datum === datum);
      if (!bestaand || (bestaand.status === "werk" && bestaand.opdrachtgever_id === props.scaniaId)) {
        await supabase.from("vakken").upsert({ medewerker_id: chauffeur, datum, status: "werk", opdrachtgever_id: props.scaniaId, notitie: `${route === "rade" ? "Rade" : "Ishøj"} · ${dienst}`, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() }, { onConflict: "medewerker_id,datum" });
      }
    }
    const naam = props.chauffeurs.find((c) => c.id === chauffeur)?.naam;
    if (auth.user) await supabase.from("wijzigingen").insert({ gebruiker_id: auth.user.id, omschrijving: `Scania-rit ${datum}, ${dienst}, ${route === "rade" ? "Rade" : "Ishøj"}: ${naam ?? "nog geen chauffeur"}`, tabel: "scania_ritten", record_id: id });
    props.onKlaar(r ? "Rit opgeslagen" : "Rit toegevoegd");
  }

  async function verwijderen() {
    if (!r || !confirm("Deze rit verwijderen?")) return;
    setBezig(true);
    const { error } = await supabase.from("scania_ritten").delete().eq("id", r.id);
    if (error) { setBezig(false); props.onFout("Verwijderen is niet gelukt."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await supabase.from("wijzigingen").insert({ gebruiker_id: auth.user.id, omschrijving: `Scania-rit ${r.vertrekdatum} (${r.dienst}) verwijderd`, tabel: "scania_ritten" });
    props.onKlaar("Rit verwijderd");
  }

  const opScania = props.chauffeurs.filter((c) => props.opScania.has(c.id));
  const overig = props.chauffeurs.filter((c) => !props.opScania.has(c.id));
  const optie = (c: Chauffeur) => {
    const a = props.afwezig(c.id, datum);
    return <option key={c.id} value={c.id}>{c.naam}{c.nationaliteit && c.nationaliteit !== "NL" ? ` (${c.nationaliteit})` : ""}{a ? ` · ${a}` : ""}</option>;
  };

  return (
    <>
      <div className="paneel-achter" onClick={props.onSluit} />
      <aside className="paneel" role="dialog" aria-label={r ? "Rit bewerken" : "Nieuwe rit"}>
        <div className="paneel-kop">
          <div><div style={{ fontSize: 13 }}>Scania-ritten</div><h2 className="machina">{r ? "Rit bewerken" : "Nieuwe rit"}</h2><div>{ROUTE_NAAM[route]}</div></div>
          <button type="button" className="icoonknop" onClick={props.onSluit} aria-label="Sluiten"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className="paneel-inhoud">
          <label className="veld"><span>Vertrekdatum</span><input className="invoer" type="date" value={datum} onChange={(e) => e.target.value && wijzig(e.target.value, dienst, route)} /></label>
          <div className="veld">
            <span>Dienst</span>
            <div className="seg" role="group" aria-label="Dienst">
              <button type="button" aria-pressed={dienst === "dag"} onClick={() => wijzig(datum, "dag", route)}>Dag</button>
              <button type="button" aria-pressed={dienst === "nacht"} onClick={() => wijzig(datum, "nacht", route)}>Nacht</button>
            </div>
          </div>
          <div className="veld">
            <span>Route</span>
            <div className="statussen">
              <button type="button" className="status-keuze" aria-pressed={route === "ishoj"} style={{ background: route === "ishoj" ? "#ffed00" : "#f7f7f6" }} onClick={() => wijzig(datum, dienst, "ishoj")}>Zwolle – Ishøj – Zwolle</button>
              <button type="button" className="status-keuze" aria-pressed={route === "rade"} style={{ background: route === "rade" ? "#ffed00" : "#f7f7f6" }} onClick={() => wijzig(datum, dienst, "rade")}>Zwolle – Rade (swap)</button>
            </div>
          </div>
          {delen.map((d, i) => (
            <div key={i} className="veld">
              <span>{route === "rade" ? "Rit via Rade (swap)" : i === 0 ? "Heen: Zwolle → Ishøj" : "Terug: Ishøj → Zwolle"}</span>
              <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 8, alignItems: "center" }}>
                <small>Vertrek</small><input className="invoer" type="datetime-local" aria-label="Vertrek" value={naarLokaal(d.vertrek)} onChange={(e) => e.target.value && setDelen(delen.map((x, j) => j === i ? { ...x, vertrek: naarIso(e.target.value) } : x))} />
                <small>Aankomst</small><input className="invoer" type="datetime-local" aria-label="Aankomst" value={naarLokaal(d.aankomst)} onChange={(e) => e.target.value && setDelen(delen.map((x, j) => j === i ? { ...x, aankomst: naarIso(e.target.value) } : x))} />
              </div>
            </div>
          ))}
          {tijdenFout && <div className="melding melding-fout" role="alert">De aankomst moet na het vertrek liggen.</div>}
          <label className="veld">
            <span>Chauffeur</span>
            <select className="invoer" value={chauffeur} onChange={(e) => setChauffeur(e.target.value)}>
              <option value="">Nog geen chauffeur</option>
              {opScania.length > 0 && <optgroup label="Op Scania deze week">{opScania.map(optie)}</optgroup>}
              <optgroup label="Overige chauffeurs">{overig.map(optie)}</optgroup>
            </select>
          </label>
          {rust && rust.uren < RUST_UREN && <div className="melding melding-fout">Maar {Math.max(0, Math.round(rust.uren))} uur rust na de vorige rit van deze chauffeur.</div>}
          {afw && <div className="melding melding-fout">Deze chauffeur staat op {afw} op {new Date(datum + "T12:00:00Z").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}.</div>}
          <label className="veld"><span>Notitie</span><input className="invoer" value={notitie} onChange={(e) => setNotitie(e.target.value)} maxLength={120} /></label>
        </div>
        <div className="paneel-voet">
          {r && <button type="button" className="knop" onClick={verwijderen} disabled={bezig}>Verwijderen</button>}
          <div style={{ flexGrow: 1 }} />
          <button type="button" className="knop" onClick={props.onSluit}>Annuleren</button>
          <button type="button" className="knop knop-zwart" onClick={opslaan} disabled={bezig || tijdenFout}>{bezig ? "Opslaan…" : "Opslaan"}</button>
        </div>
      </aside>
    </>
  );
}
