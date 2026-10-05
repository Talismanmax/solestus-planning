"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import "./verloning.css";
import Icoon from "@/components/Icoon";
import Toast, { useToast } from "@/components/Toast";
import type { Verwerkt } from "@/lib/laden";
import {
  GROEPEN, celInhoud, dagInfo, maandagVan, periodeErnaast, periodeKort, periodeParam, plusDagen, vandaagNL,
  type Afwezigheid, type Medewerker, type Opdrachtgever, type Periode, type Vak, type WeekOpmerking,
} from "@/lib/planning";
import { createClient } from "@/lib/supabase/client";
import { logWijziging } from "@/lib/wijzigingen";
import { datumKort } from "@/lib/tijd";
import VakInhoud from "@/components/VakInhoud";

type Props = {
  periode: Periode; week: number; bv: string; ik: { id: string; naam: string } | null;
  medewerkers: (Medewerker & { werkmaatschappijen: string[] })[]; opdrachtgevers: Opdrachtgever[]; vakken: Vak[]; afwezigheid: Afwezigheid[];
  opmerkingen: (WeekOpmerking & { week: number })[]; verwerkt: Verwerkt[]; laadFout: string | null;
};

type Filter = "alle" | "open" | "verwerkt";
type Mw = Props["medewerkers"][number];

/** BV's van een medewerker: de werkmaatschappijen uit Easyflex2go, anders de BV. */
const bvsVan = (m: Mw) => (m.werkmaatschappijen?.length ? m.werkmaatschappijen : m.bv ? [m.bv] : []);


/** Verloning per 4-wekenperiode: de planning week voor week, met per medewerker een vinkje "verwerkt" voor de hele periode. */
export default function Verloning(p: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [verwerkt, setVerwerkt] = useState(() => new Map(p.verwerkt.map((v) => [v.medewerker_id, v])));
  // Andere periode of verversen: de vinkjes opnieuw uit de servergegevens halen.
  const [bron, setBron] = useState(p.verwerkt);
  if (bron !== p.verwerkt) { setBron(p.verwerkt); setVerwerkt(new Map(p.verwerkt.map((v) => [v.medewerker_id, v]))); }
  const [bezig, setBezig] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("alle");
  const [zoek, setZoek] = useState("");
  const { melding, toon, sluit } = useToast();

  const { jaar, periode, weken } = p.periode;
  const pp = periodeParam(p.periode);
  const bvQ = p.bv ? `&bv=${encodeURIComponent(p.bv)}` : "";
  const maandag = maandagVan(jaar, p.week);
  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
  const vandaag = vandaagNL();
  const begin = maandagVan(jaar, weken[0]);
  const einde = plusDagen(maandagVan(jaar, weken[weken.length - 1]), 6);
  const vorige = periodeErnaast(p.periode, -1), volgende = periodeErnaast(p.periode, 1);

  const ogById = useMemo(() => new Map(p.opdrachtgevers.map((o) => [o.id, o])), [p.opdrachtgevers]);
  const vakken = useMemo(() => new Map(p.vakken.map((v) => [`${v.medewerker_id}|${v.datum}`, v])), [p.vakken]);
  const opmerking = (mwId: string) => p.opmerkingen.find((o) => o.medewerker_id === mwId && o.week === p.week)?.tekst;

  // Filter op BV, zodat de verloning per BV afgewerkt kan worden.
  const alleBvs = useMemo(() => [...new Set(p.medewerkers.flatMap(bvsVan))].sort(), [p.medewerkers]);
  const inBv = p.bv ? p.medewerkers.filter((m) => bvsVan(m).includes(p.bv)) : p.medewerkers;
  const telBv = (bv: string) => { const l = p.medewerkers.filter((m) => bvsVan(m).includes(bv)); return `${l.filter((m) => verwerkt.has(m.id)).length}/${l.length}`; };

  const q = zoek.trim().toLowerCase();
  const zichtbaar = inBv.filter((m) =>
    (!q || m.naam.toLowerCase().includes(q)) &&
    (filter === "alle" || (filter === "verwerkt") === verwerkt.has(m.id)));
  const aantalVerwerkt = inBv.filter((m) => verwerkt.has(m.id)).length;


  async function wissel(m: Medewerker, aan: boolean) {
    setBezig((b) => new Set(b).add(m.id));
    const { error } = aan
      ? await supabase.from("verloning_verwerkt").insert({ medewerker_id: m.id, jaar, periode, verwerkt_door: p.ik?.id ?? null })
      : await supabase.from("verloning_verwerkt").delete().eq("medewerker_id", m.id).eq("jaar", jaar).eq("periode", periode);
    setBezig((b) => { const n = new Set(b); n.delete(m.id); return n; });
    if (error && error.code !== "23505") { toon(`Opslaan lukte niet: ${error.message}`, true); return; }
    setVerwerkt((v) => {
      const n = new Map(v);
      if (aan) n.set(m.id, { medewerker_id: m.id, verwerkt_op: new Date().toISOString(), door: p.ik?.naam ?? "jij" });
      else n.delete(m.id);
      return n;
    });
    await logWijziging(supabase, "verloning_verwerkt", `Verloning periode ${periode} ${jaar}: ${m.naam} ${aan ? "verwerkt" : "weer open"}`, m.id);
  }

  return (
    <main className="pagina">
      <div className="kop">
        <div>
          <div className="kop-titel"><h1 className="machina">Verloning</h1></div>
          <div className="kop-meta">Periode {periode} · week {weken[0]}–{weken[weken.length - 1]} · {periodeKort(begin, einde)} {jaar}</div>
        </div>
        <div className="weekkiezer">
          <Link className="weekkiezer-pijl" href={`/verloning?periode=${periodeParam(vorige)}${bvQ}`} aria-label="Vorige periode"><Icoon naam="links" maat={20} /></Link>
          <Link className="weekkiezer-week" href={`/verloning${p.bv ? `?bv=${encodeURIComponent(p.bv)}` : ""}`} title="Naar de huidige periode">
            <b>Periode {periode}</b>
            <small>week {weken[0]}–{weken[weken.length - 1]} {jaar}</small>
          </Link>
          <Link className="weekkiezer-pijl" href={`/verloning?periode=${periodeParam(volgende)}${bvQ}`} aria-label="Volgende periode"><Icoon naam="rechts" maat={20} /></Link>
        </div>
      </div>

      {p.laadFout && <div className="melding melding-fout" role="alert" style={{ maxWidth: "none" }}><strong>Laden is niet gelukt</strong>{p.laadFout}</div>}

      <div className="werkbalk">
        <nav className="seg periode-tabs" aria-label="Week">
          {weken.map((w) => (
            <Link key={w} href={`/verloning?periode=${pp}&week=${w}${bvQ}`} aria-current={w === p.week ? "page" : undefined} scroll={false}>Week {w}</Link>
          ))}
        </nav>
        <label className="zoekveld">
          <Icoon naam="zoek" />
          <input type="search" aria-label="Zoek medewerker" placeholder="Zoek medewerker" value={zoek} onChange={(e) => setZoek(e.target.value)} />
        </label>
        <label className="bv-kiezer">
          <span className="sr-only">BV</span>
          <select className="invoer" value={p.bv} onChange={(e) => router.push(`/verloning?periode=${pp}&week=${p.week}${e.target.value ? `&bv=${encodeURIComponent(e.target.value)}` : ""}`, { scroll: false })}>
            <option value="">Alle BV&apos;s ({p.medewerkers.filter((m) => verwerkt.has(m.id)).length}/{p.medewerkers.length})</option>
            {alleBvs.map((b) => <option key={b} value={b}>{b} ({telBv(b)})</option>)}
          </select>
        </label>
        <div className="seg" role="group" aria-label="Tonen">
          <button type="button" aria-pressed={filter === "alle"} onClick={() => setFilter("alle")}>Alle</button>
          <button type="button" aria-pressed={filter === "open"} onClick={() => setFilter("open")}>Nog te doen</button>
          <button type="button" aria-pressed={filter === "verwerkt"} onClick={() => setFilter("verwerkt")}>Verwerkt</button>
        </div>
        <div style={{ flexGrow: 1 }} />
        <div className="voortgang" role="status">
          <span><strong>{aantalVerwerkt}</strong> van {inBv.length} verwerkt{p.bv ? ` bij ${p.bv.replace(/^Solestus /, "").replace(/ B\.V\.$/, "")}` : ""}</span>
          <span className="balk" aria-hidden="true"><i style={{ width: `${inBv.length ? Math.round((aantalVerwerkt / inBv.length) * 100) : 0}%` }} /></span>
        </div>
      </div>

      <section className="rooster verloning-rooster" aria-label={`Verloning periode ${periode}, week ${p.week}`}>
        <div className="rooster-kop">
          <div className="rrij">
            <span>Medewerker</span>
            {dagen.map((d, i) => {
              const info = dagInfo(d, i);
              return <span key={d} className={`dagkop${d === vandaag ? " vandaag" : ""}`}><span>{info.kort}</span><b>{info.nummer}</b></span>;
            })}
            <span>Verwerkt</span>
          </div>
        </div>
        {GROEPEN.map((g) => {
          const lijst = zichtbaar.filter((m) => m.groep === g.id);
          if (!lijst.length) return null;
          return (
            <div key={g.id}>
              <div className="groepkop"><span className="bolletje" />{g.label}<small>{lijst.length}</small></div>
              {lijst.map((m) => {
                const v = verwerkt.get(m.id);
                const opm = opmerking(m.id);
                return (
                  <div key={m.id} className={`rrij mwrij${v ? " is-verwerkt" : ""}`}>
                    <div className="naamcel">
                      <span className="naam" style={{ cursor: "default" }}>{m.naam}</span>
                      {!p.bv && alleBvs.length > 1 && <span className="opm hint">{bvsVan(m).map((b) => b.replace(/^Solestus /, "").replace(/ B\.V\.$/, "")).join(" + ") || "geen BV"}</span>}
                      {opm && <span className="opm hint" title={opm}>{opm}</span>}
                    </div>
                    {dagen.map((d, i) => {
                      const c = celInhoud(m, d, i, vakken.get(`${m.id}|${d}`), p.afwezigheid, ogById);
                      return (
                        <div key={d} className={`vakcel${i >= 5 ? " weekend" : ""}`} aria-label={`${dagInfo(d, i).lang}: ${c.label || "leeg"}${c.sub ? ", " + c.sub : ""}`}>
                          <VakInhoud c={c} />
                        </div>
                      );
                    })}
                    <div className="verwerkt-cel">
                      <label className="vink">
                        <input type="checkbox" checked={!!v} disabled={bezig.has(m.id)} onChange={(e) => wissel(m, e.target.checked)}
                          aria-label={`${m.naam} verwerkt voor periode ${periode}`} />
                        {v ? "Verwerkt" : "Verwerken"}
                      </label>
                      {v && <small>{datumKort(v.verwerkt_op)} · {v.door}</small>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {zichtbaar.length === 0 && (
          <div className="leeg-staat">
            {filter === "open" && !q ? `Iedereen${p.bv ? ` bij ${p.bv}` : ""} is verwerkt voor periode ${periode}.` : "Geen medewerkers gevonden."}
          </div>
        )}
      </section>

      <Toast melding={melding} sluit={sluit} />
    </main>
  );
}
