"use client";

import Link from "next/link";
import { useState } from "react";
import Icoon from "@/components/Icoon";
import PaneelSchil from "@/components/PaneelSchil";
import { DAG_KORT, GROEPEN, type Cel, type Medewerker, type Opdrachtgever, type Vak } from "@/lib/planning";
import type { Rit } from "@/lib/scania";
import { weekbericht } from "@/lib/weekbericht";


/** Medewerker en weekbericht: de week in één oogopslag en een bericht om in WhatsApp te plakken. */
export default function MedewerkerWeekPaneel(p: {
  mw: Medewerker; week: number; maandag: string; cellen: Cel[]; vakken: (Vak | undefined)[];
  opdrachtgevers: Map<string, Pick<Opdrachtgever, "naam" | "korte_naam">>; ritten: Rit[]; magWijzigen: boolean;
  onSluit: () => void; onAfwezigheid: () => void; onMelding: (t: string, fout?: boolean) => void;
}) {
  const standaardTaal = p.mw.groep === "int" ? "en" : "nl";
  const [taal, setTaal] = useState<"nl" | "en">(standaardTaal);
  const maak = (t: "nl" | "en") => weekbericht({ naam: p.mw.naam, week: p.week, maandag: p.maandag, taal: t, cellen: p.cellen, vakken: p.vakken, opdrachtgevers: p.opdrachtgevers, ritten: p.ritten });
  const [tekst, setTekst] = useState(() => maak(standaardTaal));
  const groep = GROEPEN.find((g) => g.id === p.mw.groep)?.label ?? "";

  function kiesTaal(t: "nl" | "en") { setTaal(t); setTekst(maak(t)); }

  async function kopieer() {
    try { await navigator.clipboard.writeText(tekst); p.onMelding("Bericht gekopieerd"); }
    catch { p.onMelding("Kopiëren lukte niet. Selecteer de tekst en kopieer hem zelf.", true); }
  }

  return (
    <PaneelSchil
      boven={[groep, p.mw.bv].filter(Boolean).join(" · ")}
      titel={p.mw.naam}
      sub={`week ${p.week}`}
      onSluit={p.onSluit}
      voet={<>
        <button type="button" className="knop knop-zwart" onClick={kopieer}><Icoon naam="kopie" />Bericht kopiëren</button>
        <button type="button" className="knop knop-tekst" onClick={p.onSluit}>Sluiten</button>
      </>}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {p.magWijzigen && <button type="button" className="knop" onClick={p.onAfwezigheid}>Afwezigheid invoeren</button>}
        <Link className="knop" href={`/stamgegevens?medewerker=${p.mw.id}`}>Stamgegevens</Link>
      </div>
      <div className="veld">
        <span className="veld-kop">Week {p.week}</span>
        <div className="weekstrip">
          {p.cellen.map((c, i) => (
            <span key={i} title={c.label || "leeg"} className={c.status ? undefined : "leeg"} style={c.status ? { background: c.bg, color: c.fg } : undefined}>
              <b>{DAG_KORT[i]}</b><span>{c.status ? c.label : "–"}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="veld">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label className="veld-kop" htmlFor="weekbericht">Weekbericht</label>
          <div className="seg" role="group" aria-label="Taal">
            <button type="button" aria-pressed={taal === "nl"} onClick={() => kiesTaal("nl")}>Nederlands</button>
            <button type="button" aria-pressed={taal === "en"} onClick={() => kiesTaal("en")}>English</button>
          </div>
        </div>
        <textarea id="weekbericht" className="invoer" style={{ height: 330, fontSize: 14, lineHeight: "21px" }} value={tekst} onChange={(e) => setTekst(e.target.value)} />
        <span className="hint">Pas de tekst gerust aan. Plak hem daarna in WhatsApp of een sms.{p.mw.telefoon ? ` Telefoon: ${p.mw.telefoon}` : ""}</span>
      </div>
    </PaneelSchil>
  );
}
