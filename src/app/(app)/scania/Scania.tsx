"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "./scania.css";
import ExportMenu from "@/components/ExportMenu";
import Icoon from "@/components/Icoon";
import Toast, { useToast } from "@/components/Toast";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import WeekKiezer from "@/components/WeekKiezer";
import { createClient } from "@/lib/supabase/client";
import { logWijziging } from "@/lib/wijzigingen";
import { DAG_KORT, dagIndex, dagInfo, dagMaand, isoWeek, plusDagen, weekParam, type Afwezigheid, type Vak } from "@/lib/planning";
import { ROUTE, STANDAARDWEEK, afwezigOp, deelRegel, ritMeldingen, ritTekst, rustVoor, RUST_UREN, standaardDelen, type Chauffeur, type Dienst, type Rit, type RitDeel, type Route } from "@/lib/scania";
import { naarIso, naarLokaal } from "@/lib/tijd";
import { LIMIET, leesUren, rijtijdStand, rijtijdVan, standaardRijtijd, uren } from "@/lib/rijtijden";

type Props = {
  week: number; maandag: string; ritten: Rit[]; chauffeurs: Chauffeur[]; scaniaId: string | null; scaniaNaam: string;
  afwezigheid: Afwezigheid[]; vakken: Vak[]; magWijzigen: boolean; laadFout: string | null;
};

const OOK_IN_PLANNING = "scania-ook-in-weekplanning";

export default function Scania(p: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [bewerk, setBewerk] = useState<Rit | "nieuw" | "extra" | null>(null);
  const [menu, setMenu] = useState<"vullen" | "kopieren" | null>(null);
  const [metChauffeurs, setMetChauffeurs] = useState(true);
  const [tekst, setTekst] = useState<string | null>(null);
  const { melding, toon, sluit } = useToast();
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
  // Rijtijd per chauffeur, de chauffeur die het krapst zit bovenaan.
  const standen = [...perChauffeur].map(([id, n]) => ({ id, n, s: rijtijdStand(p.ritten, id, p.maandag) }))
    .sort((a, b) => a.s.nog - b.s.nog || (naam.get(a.id) ?? "").localeCompare(naam.get(b.id) ?? ""));
  const openAantal = inWeek.filter((r) => !r.chauffeur_id).length;
  const extraAantal = inWeek.filter((r) => r.route === "extra").length;
  const metWaarschuwing = inWeek.filter((r) => meldingen.get(r.id)!.length).length;
  const vorigeWeek = isoWeek(plusDagen(p.maandag, -7)).week;

  const afwezig = (mwId: string, datum: string) => afwezigOp(mwId, datum, p.afwezigheid, p.vakken);

  const log = (omschrijving: string, recordId?: string) => logWijziging(supabase, "scania_ritten", omschrijving, recordId);

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
    const { data, error } = await supabase.from("scania_ritten").select("vertrekdatum, dienst, route, chauffeur_id, notitie, omschrijving, rit_delen(volgorde, van, naar, vertrek, aankomst, rijtijd_min)")
      .gte("vertrekdatum", plusDagen(p.maandag, -7)).lte("vertrekdatum", plusDagen(p.maandag, -1));
    if (error) { setBezig(false); toon("Kopiëren lukte niet.", true); return; }
    if (!data?.length) { setBezig(false); toon(`Week ${vorigeWeek} heeft geen ritten.`); return; }
    // Een week later op dezelfde klokkijd, ook als er een zomer-/wintertijdwissel tussen zit.
    const plus7 = (iso: string) => { const l = naarLokaal(iso); return naarIso(`${plusDagen(l.slice(0, 10), 7)}${l.slice(10)}`); };
    for (const r of data as Omit<Rit, "id">[]) {
      const { data: nieuw, error: e1 } = await supabase.from("scania_ritten").insert({ vertrekdatum: plusDagen(r.vertrekdatum, 7), dienst: r.dienst, route: r.route, omschrijving: r.omschrijving ?? null, chauffeur_id: metChauffeurs ? r.chauffeur_id : null, notitie: null }).select("id").single();
      if (e1 || !nieuw) { setBezig(false); toon("Kopiëren is deels mislukt.", true); router.refresh(); return; }
      const delen = r.rit_delen.map((d) => ({ rit_id: nieuw.id, volgorde: d.volgorde, van: d.van, naar: d.naar, vertrek: plus7(d.vertrek), aankomst: plus7(d.aankomst), rijtijd_min: d.rijtijd_min ?? null }));
      const { error: e2 } = delen.length ? await supabase.from("rit_delen").insert(delen) : { error: null };
      if (e2) { setBezig(false); toon("Kopiëren is deels mislukt: de tijden van een rit zijn niet opgeslagen.", true); router.refresh(); return; }
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
          <div className="kop-meta">{ROUTE.ishoj.naam} en {ROUTE.rade.naam}</div>
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
          <ExportMenu
            knop="knop knop-hoog"
            uitleg={`De ritten van week ${p.week}.`}
            keuzes={[
              { titel: "PDF, A4 liggend", sub: `alle ritten van week ${p.week}`, href: `/afdruk/scania?week=${weekParam(p.maandag)}`, soort: "liggend" },
              { titel: "Ritten als tekst kopiëren", sub: "om te plakken in WhatsApp of mail", onClick: tekstKopieren, soort: "kopie" },
            ]}
          />
          {p.magWijzigen && <button type="button" className="knop knop-hoog knop-extra" onClick={() => setBewerk("extra")}><Icoon naam="plus" />Extra opdracht</button>}
          {p.magWijzigen && <button type="button" className="knop knop-zwart knop-hoog" onClick={() => setBewerk("nieuw")}><Icoon naam="plus" />Rit toevoegen</button>}
        </div>
      </div>

      {p.laadFout && <div className="melding melding-fout" role="alert" style={{ maxWidth: "none" }}><strong>Laden is niet gelukt</strong>{p.laadFout}</div>}
      {!p.scaniaId && <div className="let-op-balk">Er is geen Scania-opdrachtgever. Zet in Stamgegevens bij de juiste opdrachtgever het vinkje ‘Scania-opdrachtgever’ aan. Ritten worden wel opgeslagen, maar niet in de weekplanning gezet.</div>}

      <div className="scania-cijfers">
        <div className="cijferkaart"><b>{inWeek.length}</b><span>Ritten deze week{extraAantal ? ` · waarvan ${extraAantal} extra` : ""}</span></div>
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
              <button type="button" key={r.id} className={`rit-rij${eersteVanDag(r, k) ? " rit-eerste" : ""}${r.route === "extra" ? " rit-extra" : ""}`} disabled={!p.magWijzigen} onClick={() => setBewerk(r)}
                aria-label={`${r.route === "extra" ? `Extra opdracht ${r.omschrijving ?? ""},` : "Rit"} ${info.kort} ${info.nummer} ${info.maand}, ${r.dienst}, ${naam.get(r.chauffeur_id ?? "") ?? "nog geen chauffeur"}`}>
                <span className="rit-dag">{eersteVanDag(r, k) ? `${info.kort} ${info.nummer} ${info.maand}` : ""}</span>
                <span className="rit-dienst">
                  {r.route === "extra"
                    ? <><span className="extra-label">Extra</span><span>{r.omschrijving?.trim() || "Extra opdracht"}</span></>
                    : <><span className={`dienst dienst-${r.dienst}`}>{r.dienst === "dag" ? "Dag" : "Nacht"}</span><span>{ROUTE[r.route].kort}</span></>}
                </span>
                <span className="rit-deel">{delen[0] ? <><b>{delen[0].titel}</b><small>{delen[0].tijden}</small></> : "–"}</span>
                <span className="rit-deel">{delen.slice(1).length ? delen.slice(1).map((d, j) => <span key={j} className="rit-deel"><b>{d.titel}</b><small>{d.tijden}</small></span>) : r.route === "rade" ? <b>Swap in Rade</b> : "–"}</span>
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
            <h2>Rijtijden</h2>
            <p className="zij-uitleg">Gepland rijden per chauffeur: deze week (max 56 u), twee weken (max 90 u) en wat er deze week nog bij kan. Alleen Scania-ritten tellen mee.</p>
            {standen.map(({ id, n, s: st }) => {
              const klasse = st.deze > LIMIET.week || st.tweeWeken > LIMIET.tweeWeken ? " over" : st.nog < LIMIET.dag ? " krap" : "";
              return (
                <div key={id} className={`rijtijd-rij${klasse}`}>
                  <div className="rijtijd-naam"><span>{naam.get(id) ?? "Onbekend"}</span><small>{n} {n === 1 ? "rit" : "ritten"}{st.verlengd ? ` · ${st.verlengd}× boven 9 u` : ""}</small></div>
                  <div className="rijtijd-balk" aria-hidden><span style={{ width: `${Math.min(100, (st.deze / LIMIET.week) * 100)}%` }} /></div>
                  <div className="rijtijd-cijfers">
                    <span><b>{uren(st.deze)}</b> week</span>
                    <span><b>{uren(st.tweeWeken)}</b> 2 weken</span>
                    <span className="rijtijd-nog"><b>{uren(st.nog)}</b> nog</span>
                  </div>
                </div>
              );
            })}
            {perChauffeur.size === 0 && <div className="zij-rij"><span>Nog niemand ingepland.</span></div>}
          </section>
          {p.magWijzigen && (
            <label className="vink zij-vink"><input type="checkbox" checked={ookInPlanning} onChange={(e) => zetOokInPlanning(e.target.checked)} />Chauffeur ook op {p.scaniaNaam} zetten in de weekplanning</label>
          )}
        </aside>
      </div>

      {bewerk && (
        <RitPaneel
          key={typeof bewerk === "string" ? bewerk : bewerk.id}
          week={p.week}
          rit={typeof bewerk === "string" ? null : bewerk}
          nieuweRoute={bewerk === "extra" ? "extra" : "ishoj"}
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
          scaniaNaam={p.scaniaNaam}
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
      <Toast melding={melding} sluit={sluit} />
    </main>
  );
}

function RitPaneel(props: {
  week: number; rit: Rit | null; nieuweRoute: Route; standaardDatum: string; chauffeurs: Chauffeur[]; opScania: Set<string>;
  afwezig: (id: string, d: string) => string | null; alleRitten: Rit[]; afwezigheid: Afwezigheid[]; scaniaId: string | null; scaniaNaam: string; vakken: Vak[];
  ookInPlanning: boolean; setOokInPlanning: (v: boolean) => void;
  onSluit: () => void; onKlaar: (t: string) => void; onFout: (t: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const r = props.rit;
  const [datum, setDatum] = useState(r?.vertrekdatum ?? props.standaardDatum);
  const [dienst, setDienst] = useState<Dienst>(r?.dienst ?? "dag");
  const [route, setRoute] = useState<Route>(r?.route ?? props.nieuweRoute);
  const [omschrijving, setOmschrijving] = useState(r?.omschrijving ?? "");
  const [delen, setDelen] = useState<RitDeel[]>(r ? [...r.rit_delen].sort((a, b) => a.volgorde - b.volgorde) : standaardDelen(props.standaardDatum, "dag", props.nieuweRoute));
  const extra = route === "extra";
  const [chauffeur, setChauffeur] = useState(r?.chauffeur_id ?? "");
  const [zoek, setZoek] = useState("");
  const [notitie, setNotitie] = useState(r?.notitie ?? "");
  const [bezig, setBezig] = useState(false);

  function wijzig(d: string, di: Dienst, ro: Route) {
    // Bij een extra opdracht met eigen plaatsen alleen de tijden meeschuiven, de plaatsen blijven.
    if (ro === "extra" && route === "extra") {
      const oud = delen[0] ? Date.parse(delen[0].vertrek) : 0;
      const nieuw = Date.parse(standaardDelen(d, di, ro)[0].vertrek);
      const schuif = (iso: string) => new Date(Date.parse(iso) + (nieuw - oud)).toISOString();
      setDatum(d); setDienst(di);
      setDelen(delen.map((x) => ({ ...x, vertrek: schuif(x.vertrek), aankomst: schuif(x.aankomst) })));
      return;
    }
    setDatum(d); setDienst(di); setRoute(ro);
    setDelen(standaardDelen(d, di, ro)); setRijInvoer({});
  }
  const zetDeel = (i: number, w: Partial<RitDeel>) => setDelen(delen.map((x, j) => (j === i ? { ...x, ...w } : x)));
  // Rijtijd zoals getypt; leeg = de standaard van de route.
  const [rijInvoer, setRijInvoer] = useState<Record<number, string>>({});
  const rijTekst = (i: number, d: RitDeel) => rijInvoer[i] ?? (d.rijtijd_min != null ? `${Math.floor(d.rijtijd_min / 60)}:${String(d.rijtijd_min % 60).padStart(2, "0")}` : "");
  function zetRijtijd(i: number, t: string) {
    setRijInvoer({ ...rijInvoer, [i]: t });
    zetDeel(i, { rijtijd_min: leesUren(t) });
  }
  const rijFout = delen.some((d, i) => rijTekst(i, d).trim() !== "" && leesUren(rijTekst(i, d)) === null);
  function deelErbij() {
    const laatste = delen[delen.length - 1];
    const plus = (iso: string, uur: number) => new Date(Date.parse(iso) + uur * 3600000).toISOString();
    setDelen([...delen, { volgorde: delen.length + 1, van: laatste?.naar ?? "Zwolle", naar: laatste?.van ?? "Zwolle", vertrek: plus(laatste.aankomst, 1), aankomst: plus(laatste.aankomst, 2) }]);
  }

  const proef: Rit = { id: r?.id ?? "nieuw", vertrekdatum: datum, dienst, route, chauffeur_id: chauffeur || null, notitie, omschrijving, rit_delen: delen };
  const rust = chauffeur ? rustVoor(proef, props.alleRitten) : null;
  const waarschuwing = chauffeur ? ritMeldingen(proef, props.alleRitten, props.afwezigheid, props.vakken).map((m) => m.lang).join(" ") : "";
  const tijdenFout = delen.some((d) => d.aankomst <= d.vertrek);
  const invulFout = extra && (!omschrijving.trim() || delen.some((d) => !d.van.trim() || !d.naar.trim()));

  async function opslaan() {
    if (tijdenFout || invulFout || rijFout) return;
    setBezig(true);
    const { data: auth } = await supabase.auth.getUser();
    const rij = { vertrekdatum: datum, dienst, route, omschrijving: extra ? omschrijving.trim() : null, chauffeur_id: chauffeur || null, notitie: notitie.trim() || null, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() };
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
    const { error: e2 } = await supabase.from("rit_delen").insert(delen.map((d, i) => ({ rit_id: id, volgorde: i + 1, van: d.van, naar: d.naar, vertrek: d.vertrek, aankomst: d.aankomst, rijtijd_min: d.rijtijd_min ?? null })));
    if (e2) { setBezig(false); props.onFout("De tijden zijn niet opgeslagen."); return; }

    // Andere chauffeur of andere dag: het oude vak in de weekplanning opruimen.
    if (r && (r.chauffeur_id !== (chauffeur || null) || r.vertrekdatum !== datum)) await vakOpruimen(r.chauffeur_id, r.vertrekdatum);

    if (props.ookInPlanning && chauffeur && props.scaniaId) {
      const bestaand = props.vakken.find((v) => v.medewerker_id === chauffeur && v.datum === datum);
      if (!bestaand || (bestaand.status === "werk" && bestaand.opdrachtgever_id === props.scaniaId)) {
        await supabase.from("vakken").upsert({ medewerker_id: chauffeur, datum, status: "werk", opdrachtgever_id: props.scaniaId, notitie: extra ? `Extra: ${omschrijving.trim()}` : `${ROUTE[route].plaats} · ${dienst}`, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() }, { onConflict: "medewerker_id,datum" });
      }
    }
    const naam = props.chauffeurs.find((c) => c.id === chauffeur)?.naam;
    const dag = `${DAG_KORT[dagIndex(datum)]} ${dagMaand(datum)}`;
    await logWijziging(supabase, "scania_ritten", `${extra ? `Scania extra opdracht (${omschrijving.trim()})` : "Scania-rit"} ${dag}, ${dienst}: ${naam ?? "nog geen chauffeur"}`, id);
    props.onKlaar(r ? (extra ? "Extra opdracht opgeslagen" : "Rit opgeslagen") : (extra ? "Extra opdracht toegevoegd" : "Rit toegevoegd"));
  }

  /** Scania-vak van een chauffeur op een dag weghalen, als die dag geen andere rit van hem meer staat. */
  async function vakOpruimen(mwId: string | null, dag: string) {
    if (!mwId || !props.scaniaId) return;
    const nogEenRit = props.alleRitten.some((x) => x.id !== r?.id && x.chauffeur_id === mwId && x.vertrekdatum === dag);
    if (nogEenRit) return;
    await supabase.from("vakken").delete()
      .eq("medewerker_id", mwId).eq("datum", dag).eq("status", "werk").eq("opdrachtgever_id", props.scaniaId);
  }

  async function verwijderen() {
    if (!r || !confirm("Deze rit verwijderen?")) return;
    setBezig(true);
    const { error } = await supabase.from("scania_ritten").delete().eq("id", r.id);
    if (error) { setBezig(false); props.onFout("Verwijderen lukte niet."); return; }
    await vakOpruimen(r.chauffeur_id, r.vertrekdatum);
    await logWijziging(supabase, "scania_ritten", `Scania-rit ${r.vertrekdatum} (${r.dienst}) verwijderd`);
    props.onKlaar("Rit verwijderd");
  }

  const q = zoek.trim().toLowerCase();
  const past = (c: Chauffeur) => !q || c.naam.toLowerCase().includes(q);
  const opScania = props.chauffeurs.filter((c) => props.opScania.has(c.id) && past(c));
  const overig = props.chauffeurs.filter((c) => !props.opScania.has(c.id) && past(c));
  const overigZichtbaar = q ? overig.slice(0, 40) : overig.slice(0, 6);
  const zonderDeze = props.alleRitten.filter((x) => x.id !== r?.id);
  const ritRij = delen.reduce((a, d) => a + rijtijdVan(route, d), 0);
  const maandag = plusDagen(datum, -dagIndex(datum));
  const knop = (c: Chauffeur) => {
    const a = props.afwezig(c.id, datum);
    const nog = rijtijdStand(zonderDeze, c.id, maandag).nog;
    return (
      <button key={c.id} type="button" aria-pressed={chauffeur === c.id} onClick={() => setChauffeur(c.id)}>
        <span>{c.naam}</span><small style={!a && nog < ritRij ? { color: "var(--fout)", fontWeight: 700 } : undefined}>{a ?? `nog ${uren(nog)}`}</small>
      </button>
    );
  };
  const legLabel = (i: number) => extra ? `Deel ${i + 1}` : route === "rade" ? "Rit via Rade (swap): Zwolle → Rade → Zwolle" : i === 0 ? "Heen: Zwolle → Ishøj" : "Terug: Ishøj → Zwolle";

  return (
    <PaneelSchil
      boven={`Scania · week ${props.week}`}
      titel={extra ? (r ? "Extra opdracht bewerken" : "Extra opdracht") : r ? "Rit bewerken" : "Nieuwe rit"}
      sub={extra ? "Naast de vaste ritten, bijv. pendelen" : ROUTE[route].naam}
      onSluit={props.onSluit}
      voet={<PaneelVoet opslaan={opslaan} opslaanLabel={bezig ? "Opslaan…" : "Opslaan"} uit={bezig || tijdenFout || invulFout || rijFout} onAnnuleren={props.onSluit} gevaar={r ? { label: "Verwijderen", onClick: verwijderen, uit: bezig } : undefined} />}
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
          <button type="button" aria-pressed={route === "ishoj"} onClick={() => wijzig(datum, dienst, "ishoj")}>{ROUTE.ishoj.naam}</button>
          <button type="button" aria-pressed={route === "rade"} onClick={() => wijzig(datum, dienst, "rade")}>{ROUTE.rade.naam}</button>
          <button type="button" className="route-extra" aria-pressed={extra} onClick={() => wijzig(datum, dienst, "extra")}>Extra opdracht <small>bijv. pendelen</small></button>
        </div>
      </fieldset>
      {extra && (
        <div className="veld">
          <label className="veld-kop" htmlFor="rit-omschrijving">Wat is de opdracht?</label>
          <input id="rit-omschrijving" className="invoer" value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} maxLength={60} placeholder="bijv. Pendelen Zwolle – Meppel" autoFocus={!r} />
        </div>
      )}
      {delen.map((d, i) => (
        <fieldset key={i} className="rit-tijden">
          <legend style={extra ? { display: "flex", justifyContent: "space-between" } : undefined}>{legLabel(i)}{extra && delen.length > 1 && <button type="button" className="link-knop" style={{ fontSize: 12 }} onClick={() => { setDelen(delen.filter((_, j) => j !== i)); setRijInvoer({}); }}>Verwijderen</button>}</legend>
          {extra && (
            <div style={{ marginBottom: 10 }}>
              <label className="veld"><span style={{ fontSize: 12, fontWeight: 600 }}>Van</span><input className="invoer" value={d.van} onChange={(e) => zetDeel(i, { van: e.target.value })} maxLength={40} /></label>
              <label className="veld"><span style={{ fontSize: 12, fontWeight: 600 }}>Naar</span><input className="invoer" value={d.naar} onChange={(e) => zetDeel(i, { naar: e.target.value })} maxLength={40} /></label>
            </div>
          )}
          <div>
            <label className="veld"><span style={{ fontSize: 12, fontWeight: 600 }}>Vertrek</span><input className="invoer" type="datetime-local" value={naarLokaal(d.vertrek)} onChange={(e) => e.target.value && setDelen(delen.map((x, j) => j === i ? { ...x, vertrek: naarIso(e.target.value) } : x))} /></label>
            <label className="veld"><span style={{ fontSize: 12, fontWeight: 600 }}>Aankomst</span><input className="invoer" type="datetime-local" value={naarLokaal(d.aankomst)} onChange={(e) => e.target.value && setDelen(delen.map((x, j) => j === i ? { ...x, aankomst: naarIso(e.target.value) } : x))} /></label>
          </div>
          <label className="veld rijtijd-veld">
            <span style={{ fontSize: 12, fontWeight: 600 }}>Rijtijd (uren:minuten)</span>
            <input className="invoer" inputMode="numeric" value={rijTekst(i, d)} onChange={(e) => zetRijtijd(i, e.target.value)} placeholder={`standaard ${uren(standaardRijtijd(route, d))}`} aria-invalid={rijTekst(i, d).trim() !== "" && leesUren(rijTekst(i, d)) === null} />
          </label>
        </fieldset>
      ))}
      {extra && <button type="button" className="knop knop-tekst" style={{ alignSelf: "flex-start" }} onClick={deelErbij}><Icoon naam="plus" />Deel toevoegen</button>}
      {invulFout && <p className="hint">Vul de opdracht en bij elk deel van en naar in.</p>}
      {rijFout && <p className="hint" role="alert" style={{ color: "var(--fout)" }}>Schrijf de rijtijd als uren:minuten, bijv. 8:30, of laat het leeg voor de standaard.</p>}
      {!rijFout && <p className="hint">Rijtijd is alleen het rijden, zonder pauzes, veerboot en wachten. Leeg = standaard voor deze route.</p>}
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
      {chauffeur && (() => {
        const st = rijtijdStand([...zonderDeze, proef], chauffeur, maandag);
        return <p className="hint">Deze rit {uren(ritRij)} rijden. Daarmee deze week {uren(st.deze)} van 56 u, twee weken {uren(st.tweeWeken)} van 90 u; nog {uren(st.nog)} over.</p>;
      })()}
      {waarschuwing && <p className="infoblok" style={{ background: "var(--fout-bg)", color: "var(--fout)", fontWeight: 600 }}>{waarschuwing}{rust && rust.uren < RUST_UREN ? ` Minimaal ${RUST_UREN} uur rust.` : ""}</p>}
      <div className="veld"><label className="veld-kop" htmlFor="rit-notitie">Notitie</label><input id="rit-notitie" className="invoer" value={notitie} onChange={(e) => setNotitie(e.target.value)} maxLength={120} placeholder="bijv. trailer wisselen, kenteken" /></div>
      <label className="vink"><input type="checkbox" checked={props.ookInPlanning} onChange={(e) => props.setOokInPlanning(e.target.checked)} />Chauffeur ook op {props.scaniaNaam} zetten in de weekplanning</label>
    </PaneelSchil>
  );
}
