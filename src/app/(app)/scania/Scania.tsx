"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "./scania.css";
import Icoon from "@/components/Icoon";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import WeekKiezer from "@/components/WeekKiezer";
import { createClient } from "@/lib/supabase/client";
import { dagInfo, isoWeek, plusDagen, weekParam, type Afwezigheid, type Vak } from "@/lib/planning";
import { ROUTE_NAAM, STANDAARDWEEK, afwezigOp, deelRegel, ritMeldingen, ritTekst, rustVoor, RUST_UREN, standaardDelen, type Chauffeur, type Dienst, type Rit, type RitDeel, type Route } from "@/lib/scania";
import { naarIso, naarLokaal } from "@/lib/tijd";

type Props = {
  week: number; maandag: string; ritten: Rit[]; chauffeurs: Chauffeur[]; scaniaId: string | null;
  afwezigheid: Afwezigheid[]; vakken: Vak[]; magWijzigen: boolean; laadFout: string | null;
};

const ROUTE_TABEL: Record<Route, string> = { ishoj: "Ishøj", rade: "Rade · swap" };
const OOK_IN_PLANNING = "scania-ook-in-weekplanning";

export default function Scania(p: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [bewerk, setBewerk] = useState<Rit | "nieuw" | null>(null);
  const [menu, setMenu] = useState<"vullen" | "export" | "kopieren" | null>(null);
  const [metChauffeurs, setMetChauffeurs] = useState(true);
  const [tekst, setTekst] = useState<string | null>(null);
  const [melding, setMelding] = useState<{ t: string; fout?: boolean } | null>(null);
  const [bezig, setBezig] = useState(false);
  const [ookInPlanning, setOokInPlanning] = useState(true);

  useEffect(() => {
    try { const v = localStorage.getItem(OOK_IN_PLANNING); if (v !== null) setOokInPlanning(v === "1"); } catch { /* geen opslag */ }
  }, []);
  function zetOokInPlanning(v: boolean) {
    setOokInPlanning(v);
    try { localStorage.setItem(OOK_IN_PLANNING, v ? "1" : "0"); } catch { /* geen opslag */ }
  }

  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(p.maandag, i));
  const naam = useMemo(() => new Map(p.chauffeurs.map((c) => [c.id, c.naam])), [p.chauffeurs]);
  const start = (r: Rit) => [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde)[0]?.vertrek ?? "";
  const inWeek = p.ritten.filter((r) => r.vertrekdatum >= p.maandag && r.vertrekdatum <= dagen[6])
    .sort((a, b) => a.vertrekdatum.localeCompare(b.vertrekdatum) || start(a).localeCompare(start(b)));
  const meldingen = new Map(inWeek.map((r) => [r.id, ritMeldingen(r, p.ritten, p.afwezigheid, p.vakken)]));
  const perChauffeur = new Map<string, number>();
  inWeek.forEach((r) => { if (r.chauffeur_id) perChauffeur.set(r.chauffeur_id, (perChauffeur.get(r.chauffeur_id) ?? 0) + 1); });
  const openAantal = inWeek.filter((r) => !r.chauffeur_id).length;
  const metWaarschuwing = inWeek.filter((r) => meldingen.get(r.id)!.length).length;
  const vorigeWeek = isoWeek(plusDagen(p.maandag, -7)).week;

  function toon(t: string, fout = false) { setMelding({ t, fout }); setTimeout(() => setMelding(null), fout ? 6000 : 2500); }
  const afwezig = (mwId: string, datum: string) => afwezigOp(mwId, datum, p.afwezigheid, p.vakken);

  async function log(omschrijving: string, recordId?: string) {
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from("wijzigingen").insert({ gebruiker_id: data.user.id, omschrijving, tabel: "scania_ritten", record_id: recordId ?? null });
  }

  async function standaardWeekInvullen() {
    setMenu(null);
    setBezig(true);
    // Ritten die er al staan (zelfde dag, dienst en route) niet dubbel toevoegen.
    const ontbreekt = STANDAARDWEEK.map((s) => ({ ...s, datum: plusDagen(p.maandag, s.dag) }))
      .filter((s) => !inWeek.some((r) => r.vertrekdatum === s.datum && r.dienst === s.dienst && r.route === s.route));
    if (!ontbreekt.length) { setBezig(false); toon(`De standaardritten staan al in week ${p.week}.`); return; }
    for (const s of ontbreekt) {
      const { data: nieuw, error } = await supabase.from("scania_ritten").insert({ vertrekdatum: s.datum, dienst: s.dienst, route: s.route, chauffeur_id: null, notitie: null }).select("id").single();
      if (error || !nieuw) { setBezig(false); toon("Invullen is deels mislukt.", true); router.refresh(); return; }
      const delen = standaardDelen(s.datum, s.dienst, s.route).map((d) => ({ rit_id: nieuw.id, volgorde: d.volgorde, van: d.van, naar: d.naar, vertrek: d.vertrek, aankomst: d.aankomst }));
      const { error: e2 } = await supabase.from("rit_delen").insert(delen);
      if (e2) { setBezig(false); toon("Invullen is deels mislukt.", true); router.refresh(); return; }
    }
    await log(`Standaardweek ingevuld in week ${p.week}: ${ontbreekt.length} ${ontbreekt.length === 1 ? "rit" : "ritten"}`);
    setBezig(false);
    toon(`${ontbreekt.length} ${ontbreekt.length === 1 ? "rit" : "ritten"} toegevoegd`);
    router.refresh();
  }

  async function vorigeWeekKopieren() {
    setMenu(null);
    setBezig(true);
    const { data, error } = await supabase.from("scania_ritten").select("vertrekdatum, dienst, route, chauffeur_id, notitie, rit_delen(volgorde, van, naar, vertrek, aankomst)")
      .gte("vertrekdatum", plusDagen(p.maandag, -7)).lte("vertrekdatum", plusDagen(p.maandag, -1));
    if (error) { setBezig(false); toon("Kopiëren lukte niet.", true); return; }
    if (!data?.length) { setBezig(false); toon(`Week ${vorigeWeek} heeft geen ritten.`); return; }
    const plus7 = (iso: string) => new Date(new Date(iso).getTime() + 7 * 86400000).toISOString();
    for (const r of data as Omit<Rit, "id">[]) {
      const { data: nieuw, error: e1 } = await supabase.from("scania_ritten").insert({ vertrekdatum: plusDagen(r.vertrekdatum, 7), dienst: r.dienst, route: r.route, chauffeur_id: metChauffeurs ? r.chauffeur_id : null, notitie: null }).select("id").single();
      if (e1 || !nieuw) { setBezig(false); toon("Kopiëren is deels mislukt.", true); router.refresh(); return; }
      const delen = r.rit_delen.map((d) => ({ rit_id: nieuw.id, volgorde: d.volgorde, van: d.van, naar: d.naar, vertrek: plus7(d.vertrek), aankomst: plus7(d.aankomst) }));
      if (delen.length) await supabase.from("rit_delen").insert(delen);
    }
    await log(`Scania-ritten van week ${vorigeWeek} gekopieerd naar week ${p.week}${metChauffeurs ? "" : " (zonder chauffeurs)"}`);
    setBezig(false);
    toon(`${data.length} ${data.length === 1 ? "rit" : "ritten"} gekopieerd`);
    router.refresh();
  }

  function ritTekstVanWeek() {
    const per = new Map<string, Rit[]>();
    const open: Rit[] = [];
    for (const r of inWeek) {
      if (!r.chauffeur_id) { open.push(r); continue; }
      per.set(r.chauffeur_id, [...(per.get(r.chauffeur_id) ?? []), r]);
    }
    const blokken = [...per.entries()].map(([id, rs]) => `${naam.get(id) ?? "Onbekend"}\n${rs.map((r) => ritTekst(r)).join("\n")}`);
    if (open.length) blokken.push(`Nog geen chauffeur\n${open.map((r) => ritTekst(r)).join("\n")}`);
    return `Scania-ritten week ${p.week}\n\n${blokken.join("\n\n") || "Geen ritten gepland."}`;
  }

  async function tekstKopieren() {
    setMenu(null);
    const t = ritTekstVanWeek();
    try { await navigator.clipboard.writeText(t); toon("Ritten gekopieerd"); }
    catch { setTekst(t); }
  }

  const eersteVanDag = (r: Rit, k: number) => k === 0 || inWeek[k - 1].vertrekdatum !== r.vertrekdatum;

  return (
    <main className="pagina">
      <div className="kop">
        <div>
          <div className="kop-titel"><h1 className="machina">Scania-ritten</h1></div>
          <div className="kop-meta">{ROUTE_NAAM.ishoj} en {ROUTE_NAAM.rade}</div>
        </div>
        <div className="kop-acties">
          <WeekKiezer pad="/scania" maandag={p.maandag} />
          {p.magWijzigen && (
            <div className="menu-anker">
              <button type="button" className="knop knop-hoog" aria-expanded={menu === "vullen"} aria-haspopup="menu" disabled={bezig} onClick={() => setMenu(menu === "vullen" ? null : "vullen")}
                style={menu === "vullen" ? { boxShadow: "0 0 0 3px var(--geel)" } : undefined}>
                <Icoon naam="kopie" />{bezig ? "Bezig…" : "Week vullen"}<Icoon naam="omlaag" maat={16} />
              </button>
              {(menu === "vullen" || menu === "kopieren") && (
                <>
                  <div className="menu-sluiter" onClick={() => setMenu(null)} />
                  {menu === "vullen" ? (
                    <div className="menu export-menu" role="menu" aria-label="Week vullen" style={{ width: 340 }}>
                      <button type="button" role="menuitem" className="export-keuze" style={{ height: "auto", minHeight: 64, padding: "10px 12px" }} onClick={() => setMenu("kopieren")}>
                        <span className="export-icoon"><Icoon naam="kopie" maat={20} /></span>
                        <span><b>Vorige week kopiëren</b><small>Ritten van week {vorigeWeek} schuiven een week op, met of zonder chauffeurs</small></span>
                      </button>
                      <button type="button" role="menuitem" className="export-keuze" style={{ height: "auto", minHeight: 64, padding: "10px 12px" }} onClick={standaardWeekInvullen}>
                        <span className="export-icoon"><Icoon naam="wissel" maat={20} /></span>
                        <span><b>Standaardweek invullen</b><small>{STANDAARDWEEK.length} vaste ritten: ma–vr afwisselend dag en nacht naar Ishøj, za en zo Rade (swap), zo-nacht Ishøj; zonder chauffeurs</small></span>
                      </button>
                      <span className="export-uitleg">Staan er al ritten in week {p.week}, dan komen de nieuwe ritten erbij. Standaardritten die er al staan, worden niet dubbel toegevoegd.</span>
                    </div>
                  ) : (
                    <div className="menu kopieer-menu" role="dialog" aria-label={`Ritten van week ${vorigeWeek} kopiëren`}>
                      <h2>Ritten van week {vorigeWeek} kopiëren</h2>
                      <p>{inWeek.length ? `Week ${p.week} heeft al ${inWeek.length} ${inWeek.length === 1 ? "rit" : "ritten"}; de ritten van week ${vorigeWeek} komen erbij.` : `De ritten van week ${vorigeWeek} schuiven een week op naar week ${p.week}.`}</p>
                      <label className="vink"><input type="checkbox" checked={metChauffeurs} onChange={(e) => setMetChauffeurs(e.target.checked)} />Chauffeurs meenemen</label>
                      <div className="kopieer-knoppen">
                        <button type="button" className="knop knop-tekst" onClick={() => setMenu(null)}>Annuleren</button>
                        <button type="button" className="knop knop-zwart" autoFocus onClick={vorigeWeekKopieren}>Kopiëren</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className="menu-anker">
            <button type="button" className="knop knop-hoog" aria-expanded={menu === "export"} aria-haspopup="menu" onClick={() => setMenu(menu === "export" ? null : "export")}
              style={menu === "export" ? { boxShadow: "0 0 0 3px var(--geel)" } : undefined}>
              <Icoon naam="download" />Exporteren<Icoon naam="omlaag" maat={16} />
            </button>
            {menu === "export" && (
              <>
                <div className="menu-sluiter" onClick={() => setMenu(null)} />
                <div className="menu export-menu" role="menu" aria-label="Exporteren">
                  <a role="menuitem" className="export-keuze" href={`/afdruk/scania?week=${weekParam(p.maandag)}`} target="_blank" rel="noopener" onClick={() => setMenu(null)}>
                    <span className="export-icoon"><span className="export-blad export-liggend" /></span>
                    <span><b>PDF, A4 liggend</b><small>alle ritten van week {p.week}</small></span>
                  </a>
                  <button type="button" role="menuitem" className="export-keuze" onClick={tekstKopieren}>
                    <span className="export-icoon"><Icoon naam="kopie" maat={20} /></span>
                    <span><b>Ritten als tekst kopiëren</b><small>om te plakken in WhatsApp of mail</small></span>
                  </button>
                </div>
              </>
            )}
          </div>
          {p.magWijzigen && <button type="button" className="knop knop-zwart knop-hoog" onClick={() => setBewerk("nieuw")}><Icoon naam="plus" />Rit toevoegen</button>}
        </div>
      </div>

      {p.laadFout && <div className="melding melding-fout" role="alert" style={{ maxWidth: "none" }}><strong>Laden is niet gelukt</strong>{p.laadFout}</div>}
      {!p.scaniaId && <div className="voorbeeld">Opdrachtgever Scania (Easyflex2go-relatie “Manpower AB”) is niet gevonden in de stamgegevens. Ritten worden wel opgeslagen, maar niet in de weekplanning gezet.</div>}

      <div className="scania-cijfers">
        <div className="cijferkaart"><b>{inWeek.length}</b><span>Ritten deze week</span></div>
        <div className="cijferkaart geel"><b>{openAantal}</b><span>Zonder chauffeur</span></div>
        <div className="cijferkaart"><b>{perChauffeur.size}</b><span>Chauffeurs ingezet</span></div>
        <div className="cijferkaart zwart"><b>{metWaarschuwing}</b><span>Ritten met een waarschuwing</span></div>
      </div>

      <div className="scania-raster">
        <section className="kaart ritten" aria-label={`Ritten week ${p.week}`}>
          <div className="rit-rij rit-kop"><span>Vertrek</span><span>Dienst</span><span>Heen</span><span>Terug</span><span>Chauffeur</span></div>
          {inWeek.map((r, k) => {
            const delen = [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde).map(deelRegel);
            const i = dagen.indexOf(r.vertrekdatum);
            const info = dagInfo(r.vertrekdatum, i);
            const m = meldingen.get(r.id)!;
            return (
              <button type="button" key={r.id} className={`rit-rij${eersteVanDag(r, k) ? " rit-eerste" : ""}`} disabled={!p.magWijzigen} onClick={() => setBewerk(r)}
                aria-label={`Rit ${info.kort} ${info.nummer} ${info.maand}, ${r.dienst}, ${naam.get(r.chauffeur_id ?? "") ?? "nog geen chauffeur"}`}>
                <span className="rit-dag">{eersteVanDag(r, k) ? `${info.kort} ${info.nummer} ${info.maand}` : ""}</span>
                <span className="rit-dienst"><span className={`dienst dienst-${r.dienst}`}>{r.dienst === "dag" ? "Dag" : "Nacht"}</span><span>{ROUTE_TABEL[r.route]}</span></span>
                <span className="rit-deel">{delen[0] ? <><b>{delen[0].titel}</b><small>{delen[0].tijden}</small></> : "–"}</span>
                <span className="rit-deel">{delen[1] ? <><b>{delen[1].titel}</b><small>{delen[1].tijden}</small></> : r.route === "rade" ? <b>Swap in Rade</b> : "–"}</span>
                <span className="rit-chauffeur">
                  {r.chauffeur_id ? <b>{naam.get(r.chauffeur_id) ?? "Onbekend"}</b> : <b className="rit-open"><span className="bolletje" style={{ width: 9, height: 9 }} />Nog geen chauffeur</b>}
                  {m.map((x) => <span key={x.kort} className="rit-let">! {x.kort}</span>)}
                  {r.notitie && <small>{r.notitie}</small>}
                </span>
              </button>
            );
          })}
          {inWeek.length === 0 && <div className="rit-leeg">Nog geen ritten in week {p.week}.{p.magWijzigen ? " Voeg een rit toe, of vul de week met de standaardweek of de ritten van vorige week." : ""}</div>}
        </section>

        <aside className="scania-zij">
          {metWaarschuwing > 0 && (
            <section className="kaart zijkaart">
              <h2>Let op</h2>
              {inWeek.filter((r) => meldingen.get(r.id)!.length).map((r) => {
                const info = dagInfo(r.vertrekdatum, dagen.indexOf(r.vertrekdatum));
                return meldingen.get(r.id)!.map((x) => (
                  <div key={r.id + x.kort} className="let-op">
                    <b>{naam.get(r.chauffeur_id!) ?? "Chauffeur"} · {info.kort} {info.nummer} {info.maand}</b>
                    <span>{x.lang}</span>
                  </div>
                ));
              })}
            </section>
          )}
          <section className="kaart zijkaart">
            <h2>Chauffeurs deze week</h2>
            {[...perChauffeur].sort((a, b) => b[1] - a[1] || (naam.get(a[0]) ?? "").localeCompare(naam.get(b[0]) ?? "")).map(([id, n]) => (
              <div key={id} className="zij-rij"><span>{naam.get(id) ?? "Onbekend"}</span><span><strong>{n}</strong> {n === 1 ? "rit" : "ritten"}</span></div>
            ))}
            {perChauffeur.size === 0 && <div className="zij-rij"><span>Nog niemand ingepland.</span></div>}
          </section>
          {p.magWijzigen && (
            <label className="vink zij-vink"><input type="checkbox" checked={ookInPlanning} onChange={(e) => zetOokInPlanning(e.target.checked)} />Chauffeur ook op Manpower / Scania zetten in de weekplanning</label>
          )}
        </aside>
      </div>

      {bewerk && (
        <RitPaneel
          key={bewerk === "nieuw" ? "nieuw" : bewerk.id}
          week={p.week}
          rit={bewerk === "nieuw" ? null : bewerk}
          standaardDatum={dagen[0]}
          chauffeurs={p.chauffeurs}
          opScania={new Set(inWeek.map((r) => r.chauffeur_id).filter(Boolean) as string[])}
          afwezig={afwezig}
          alleRitten={p.ritten}
          afwezigheid={p.afwezigheid}
          ookInPlanning={ookInPlanning}
          setOokInPlanning={zetOokInPlanning}
          onSluit={() => setBewerk(null)}
          onKlaar={(t) => { setBewerk(null); toon(t); router.refresh(); }}
          onFout={(t) => toon(t, true)}
          scaniaId={p.scaniaId}
          vakken={p.vakken}
        />
      )}

      {tekst !== null && (
        <div className="dialoog-achter" onClick={() => setTekst(null)}>
          <section className="dialoog" role="dialog" aria-label="Ritten als tekst" onClick={(e) => e.stopPropagation()}>
            <div className="dialoog-kop"><h2 className="machina">Ritten als tekst</h2><button type="button" className="icoonknop" onClick={() => setTekst(null)} aria-label="Sluiten"><Icoon naam="sluiten" maat={20} /></button></div>
            <p style={{ margin: 0 }}>Kopiëren naar het klembord lukte niet. Selecteer de tekst en kopieer hem zelf.</p>
            <textarea className="invoer" readOnly value={tekst} rows={16} style={{ minHeight: 320 }} />
          </section>
        </div>
      )}
      {melding && <div className="toast" role={melding.fout ? "alert" : "status"}>{melding.fout && <Icoon naam="waarschuwing" maat={20} />}<span>{melding.t}</span></div>}
    </main>
  );
}

function RitPaneel(props: {
  week: number; rit: Rit | null; standaardDatum: string; chauffeurs: Chauffeur[]; opScania: Set<string>;
  afwezig: (id: string, d: string) => string | null; alleRitten: Rit[]; afwezigheid: Afwezigheid[]; scaniaId: string | null; vakken: Vak[];
  ookInPlanning: boolean; setOokInPlanning: (v: boolean) => void;
  onSluit: () => void; onKlaar: (t: string) => void; onFout: (t: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const r = props.rit;
  const [datum, setDatum] = useState(r?.vertrekdatum ?? props.standaardDatum);
  const [dienst, setDienst] = useState<Dienst>(r?.dienst ?? "dag");
  const [route, setRoute] = useState<Route>(r?.route ?? "ishoj");
  const [delen, setDelen] = useState<RitDeel[]>(r ? [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde) : standaardDelen(props.standaardDatum, "dag", "ishoj"));
  const [chauffeur, setChauffeur] = useState(r?.chauffeur_id ?? "");
  const [zoek, setZoek] = useState("");
  const [notitie, setNotitie] = useState(r?.notitie ?? "");
  const [bezig, setBezig] = useState(false);

  function wijzig(d: string, di: Dienst, ro: Route) {
    setDatum(d); setDienst(di); setRoute(ro);
    setDelen(standaardDelen(d, di, ro));
  }

  const proef: Rit = { id: r?.id ?? "nieuw", vertrekdatum: datum, dienst, route, chauffeur_id: chauffeur || null, notitie, rit_delen: delen };
  const rust = chauffeur ? rustVoor(proef, props.alleRitten) : null;
  const waarschuwing = chauffeur ? ritMeldingen(proef, props.alleRitten, props.afwezigheid, props.vakken).map((m) => m.lang).join(" ") : "";
  const tijdenFout = delen.some((d) => d.aankomst <= d.vertrek);

  async function opslaan() {
    if (tijdenFout) return;
    setBezig(true);
    const { data: auth } = await supabase.auth.getUser();
    const rij = { vertrekdatum: datum, dienst, route, chauffeur_id: chauffeur || null, notitie: notitie.trim() || null, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() };
    let id = r?.id;
    if (id) {
      const { error } = await supabase.from("scania_ritten").update(rij).eq("id", id);
      if (error) { setBezig(false); props.onFout("Opslaan lukte niet."); return; }
      await supabase.from("rit_delen").delete().eq("rit_id", id);
    } else {
      const { data, error } = await supabase.from("scania_ritten").insert(rij).select("id").single();
      if (error || !data) { setBezig(false); props.onFout("Opslaan lukte niet."); return; }
      id = data.id;
    }
    const { error: e2 } = await supabase.from("rit_delen").insert(delen.map((d, i) => ({ rit_id: id, volgorde: i + 1, van: d.van, naar: d.naar, vertrek: d.vertrek, aankomst: d.aankomst })));
    if (e2) { setBezig(false); props.onFout("De tijden zijn niet opgeslagen."); return; }

    if (props.ookInPlanning && chauffeur && props.scaniaId) {
      const bestaand = props.vakken.find((v) => v.medewerker_id === chauffeur && v.datum === datum);
      if (!bestaand || (bestaand.status === "werk" && bestaand.opdrachtgever_id === props.scaniaId)) {
        await supabase.from("vakken").upsert({ medewerker_id: chauffeur, datum, status: "werk", opdrachtgever_id: props.scaniaId, notitie: `${route === "rade" ? "Rade" : "Ishøj"} · ${dienst}`, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() }, { onConflict: "medewerker_id,datum" });
      }
    }
    const naam = props.chauffeurs.find((c) => c.id === chauffeur)?.naam;
    const dag = new Date(datum + "T12:00:00Z").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }).replace(".", "");
    if (auth.user) await supabase.from("wijzigingen").insert({ gebruiker_id: auth.user.id, omschrijving: `Scania-rit ${dag}, ${dienst}: ${naam ?? "nog geen chauffeur"}`, tabel: "scania_ritten", record_id: id });
    props.onKlaar(r ? "Rit opgeslagen" : "Rit toegevoegd");
  }

  async function verwijderen() {
    if (!r || !confirm("Deze rit verwijderen?")) return;
    setBezig(true);
    const { error } = await supabase.from("scania_ritten").delete().eq("id", r.id);
    if (error) { setBezig(false); props.onFout("Verwijderen lukte niet."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await supabase.from("wijzigingen").insert({ gebruiker_id: auth.user.id, omschrijving: `Scania-rit ${r.vertrekdatum} (${r.dienst}) verwijderd`, tabel: "scania_ritten" });
    props.onKlaar("Rit verwijderd");
  }

  const q = zoek.trim().toLowerCase();
  const past = (c: Chauffeur) => !q || c.naam.toLowerCase().includes(q);
  const opScania = props.chauffeurs.filter((c) => props.opScania.has(c.id) && past(c));
  const overig = props.chauffeurs.filter((c) => !props.opScania.has(c.id) && past(c));
  const overigZichtbaar = q ? overig.slice(0, 40) : overig.slice(0, 6);
  const knop = (c: Chauffeur) => {
    const a = props.afwezig(c.id, datum);
    return (
      <button key={c.id} type="button" aria-pressed={chauffeur === c.id} onClick={() => setChauffeur(c.id)}>
        <span>{c.naam}</span><small>{a ?? (c.nationaliteit && c.nationaliteit !== "NL" ? c.nationaliteit : "")}</small>
      </button>
    );
  };
  const legLabel = (i: number) => route === "rade" ? "Rit via Rade (swap): Zwolle → Rade → Zwolle" : i === 0 ? "Heen: Zwolle → Ishøj" : "Terug: Ishøj → Zwolle";

  return (
    <PaneelSchil
      boven={`Scania · week ${props.week}`}
      titel={r ? "Rit bewerken" : "Nieuwe rit"}
      sub={ROUTE_NAAM[route]}
      onSluit={props.onSluit}
      voet={<PaneelVoet opslaan={opslaan} opslaanLabel={bezig ? "Opslaan…" : "Opslaan"} uit={bezig || tijdenFout} onAnnuleren={props.onSluit} gevaar={r ? { label: "Verwijderen", onClick: verwijderen, uit: bezig } : undefined} />}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
        <div className="veld"><label className="veld-kop" htmlFor="rit-datum">Vertrekdatum</label><input id="rit-datum" className="invoer" type="date" value={datum} onChange={(e) => e.target.value && wijzig(e.target.value, dienst, route)} /></div>
        <fieldset className="veld"><legend style={{ marginBottom: 0 }}>Dienst</legend>
          <div className="seg seg-vol" role="group" aria-label="Dienst">
            <button type="button" aria-pressed={dienst === "dag"} onClick={() => wijzig(datum, "dag", route)}>Dag</button>
            <button type="button" aria-pressed={dienst === "nacht"} onClick={() => wijzig(datum, "nacht", route)}>Nacht</button>
          </div>
        </fieldset>
      </div>
      <fieldset className="veld"><legend style={{ marginBottom: 0 }}>Route</legend>
        <div className="route-keuze">
          <button type="button" aria-pressed={route === "ishoj"} onClick={() => wijzig(datum, dienst, "ishoj")}>{ROUTE_NAAM.ishoj}</button>
          <button type="button" aria-pressed={route === "rade"} onClick={() => wijzig(datum, dienst, "rade")}>{ROUTE_NAAM.rade}</button>
        </div>
      </fieldset>
      {delen.map((d, i) => (
        <fieldset key={i} className="rit-tijden">
          <legend>{legLabel(i)}</legend>
          <div>
            <label className="veld"><span style={{ fontSize: 12, fontWeight: 600 }}>Vertrek</span><input className="invoer" type="datetime-local" value={naarLokaal(d.vertrek)} onChange={(e) => e.target.value && setDelen(delen.map((x, j) => j === i ? { ...x, vertrek: naarIso(e.target.value) } : x))} /></label>
            <label className="veld"><span style={{ fontSize: 12, fontWeight: 600 }}>Aankomst</span><input className="invoer" type="datetime-local" value={naarLokaal(d.aankomst)} onChange={(e) => e.target.value && setDelen(delen.map((x, j) => j === i ? { ...x, aankomst: naarIso(e.target.value) } : x))} /></label>
          </div>
        </fieldset>
      ))}
      {tijdenFout && <p className="infoblok" style={{ background: "var(--fout-bg)", color: "var(--fout)", fontWeight: 600 }} role="alert">De aankomst moet na het vertrek liggen.</p>}
      <div className="veld">
        <label className="veld-kop" htmlFor="rit-chauffeur">Chauffeur</label>
        <input id="rit-chauffeur" className="invoer" type="search" placeholder="Zoek chauffeur" value={zoek} onChange={(e) => setZoek(e.target.value)} autoComplete="off" />
        <div className="keuzelijst" role="group" aria-label="Chauffeurs" style={{ maxHeight: 320 }}>
          {!q && <button type="button" aria-pressed={!chauffeur} onClick={() => setChauffeur("")}><span>Nog geen chauffeur</span></button>}
          {opScania.length > 0 && <span className="keuzelijst-kop">Op Scania deze week</span>}
          {opScania.map(knop)}
          {overigZichtbaar.length > 0 && <span className="keuzelijst-kop">{opScania.length ? "Overige chauffeurs" : "Chauffeurs"}</span>}
          {overigZichtbaar.map(knop)}
          {!q && overig.length > overigZichtbaar.length && <span className="keuzelijst-leeg">Nog {overig.length - overigZichtbaar.length} andere; zoek om ze te vinden.</span>}
          {q && opScania.length + overig.length === 0 && <span className="keuzelijst-leeg">Geen chauffeur gevonden.</span>}
        </div>
      </div>
      {waarschuwing && <p className="infoblok" style={{ background: "var(--fout-bg)", color: "var(--fout)", fontWeight: 600 }}>{waarschuwing}{rust && rust.uren < RUST_UREN ? ` Minimaal ${RUST_UREN} uur rust.` : ""}</p>}
      <div className="veld"><label className="veld-kop" htmlFor="rit-notitie">Notitie</label><input id="rit-notitie" className="invoer" value={notitie} onChange={(e) => setNotitie(e.target.value)} maxLength={120} placeholder="bijv. trailer wisselen, kenteken" /></div>
      <label className="vink"><input type="checkbox" checked={props.ookInPlanning} onChange={(e) => props.setOokInPlanning(e.target.checked)} />Chauffeur ook op Manpower / Scania zetten in de weekplanning</label>
    </PaneelSchil>
  );
}
