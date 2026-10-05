"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Legenda from "./Legenda";
import MedewerkerWeekPaneel from "./MedewerkerWeekPaneel";
import VakPaneel, { type Invulling } from "./VakPaneel";
import VasteInzetKnop from "./VasteInzetKnop";
import WeekKopieren from "./WeekKopieren";
import AfwezigheidPaneel from "@/components/AfwezigheidPaneel";
import ExportMenu from "@/components/ExportMenu";
import Icoon from "@/components/Icoon";
import Toast, { useToast } from "@/components/Toast";
import PaneelSchil, { PaneelVoet } from "@/components/PaneelSchil";
import WeekKiezer from "@/components/WeekKiezer";
import { weekNaarExcel } from "@/lib/excel";
import { createClient } from "@/lib/supabase/client";
import { logWijziging } from "@/lib/wijzigingen";
import { afwezigheidOp,
  GROEPEN, STATUS, celInhoud, dagIndex, dagInfo, dagTelling, geldigeVasteInzet, isoWeek, opdrachtgeverLabel, periodeKort, plusDagen, vandaagNL, weekParam,
  type Afwezigheid, type Medewerker, type Opdrachtgever, type Vak, type VakStatus, type WeekOpmerking,
} from "@/lib/planning";
import type { Rit } from "@/lib/scania";
import { tijdstipNL } from "@/lib/tijd";
import VakInhoud from "@/components/VakInhoud";
import { VAK_KOLOMMEN } from "@/lib/laden";

type Props = {
  jaar: number; week: number; maandag: string;
  medewerkers: Medewerker[]; opdrachtgevers: Opdrachtgever[]; vakken: Vak[];
  afwezigheid: Afwezigheid[]; opmerkingen: WeekOpmerking[]; ritten: Rit[];
  magWijzigen: boolean; laatstGewijzigd: { tijdstip: string; door: string } | null; laadFout: string | null;
};

type Paneel =
  | { soort: "vak"; mw: Medewerker; dag: number }
  | { soort: "opmerking"; mw: Medewerker }
  | { soort: "meerdere" }
  | { soort: "medewerker"; mw: Medewerker }
  | { soort: "afwezigheid"; mw: Medewerker; datum: string }
  | null;

type Filters = { groep: string; og: string; bv: string };

const sleutel = (mwId: string, datum: string) => `${mwId}|${datum}`;
/** Wat "Afwezigheid niet meenemen" overslaat bij het kopiëren van de vorige week. */
const AFWEZIG_NIET_KOPIEREN: VakStatus[] = ["vakantie", "ziek", "vrij", "einde"];
const GEEN_FILTER: Filters = { groep: "alle", og: "", bv: "" };

export default function Weekplanning(p: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [vakken, setVakken] = useState<Map<string, Vak>>(() => new Map(p.vakken.map((v) => [sleutel(v.medewerker_id, v.datum), v])));
  const [opmerkingen, setOpmerkingen] = useState<Map<string, WeekOpmerking>>(() => new Map(p.opmerkingen.map((o) => [o.medewerker_id, o])));
  const [paneel, setPaneel] = useState<Paneel>(null);
  const [zoek, setZoek] = useState("");
  const [filters, setFilters] = useState<Filters>(GEEN_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [legenda, setLegenda] = useState(false);
  const { melding: toastMelding, toon: melding, sluit: sluitToast } = useToast();
  const [selectie, setSelectie] = useState<Set<string>>(new Set());
  // Nieuwe gegevens van de server (andere week of verversen): de eigen kopie bijwerken.
  // Zonder dit bleef na het wisselen van week de vorige week in de staat staan en leek de planning leeg.
  const [bron, setBron] = useState({ vakken: p.vakken, opmerkingen: p.opmerkingen });
  if (bron.vakken !== p.vakken || bron.opmerkingen !== p.opmerkingen) {
    setBron({ vakken: p.vakken, opmerkingen: p.opmerkingen });
    setVakken(new Map(p.vakken.map((v) => [sleutel(v.medewerker_id, v.datum), v])));
    setOpmerkingen(new Map(p.opmerkingen.map((o) => [o.medewerker_id, o])));
    if (bron.vakken !== p.vakken) setSelectie(new Set());
  }
  const [klembord, setKlembord] = useState<Invulling | null>(null);
  const [kopieerOpen, setKopieerOpen] = useState(false);
  const [vasteOpen, setVasteOpen] = useState(false);

  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(p.maandag, i));
  const vandaag = vandaagNL();
  const [weergave, setWeergave] = useState<"week" | "dag">("week");
  const [dag, setDag] = useState(() => Math.max(0, dagen.indexOf(vandaag)));
  const ogById = useMemo(() => new Map(p.opdrachtgevers.map((o) => [o.id, o])), [p.opdrachtgevers]);
  const mwById = useMemo(() => new Map(p.medewerkers.map((m) => [m.id, m])), [p.medewerkers]);
  const bvs = useMemo(() => [...new Set(p.medewerkers.map((m) => m.bv).filter((b): b is string => !!b))].sort(), [p.medewerkers]);

  const afwezigOp = (mwId: string, datum: string) => afwezigheidOp(p.afwezigheid, mwId, datum);
  const cel = (mw: Medewerker, datum: string, i: number) => celInhoud(mw, datum, i, vakken.get(sleutel(mw.id, datum)), p.afwezigheid, ogById);

  // Zoeken op medewerker of opdrachtgever; filters op groep, opdrachtgever en BV.
  const q = zoek.trim().toLowerCase();
  const zichtbaar = p.medewerkers.filter((m) => {
    if (filters.groep !== "alle" && m.groep !== filters.groep) return false;
    if (filters.bv && m.bv !== filters.bv) return false;
    if (filters.og && !dagen.some((d) => vakken.get(sleutel(m.id, d))?.opdrachtgever_id === filters.og)) return false;
    if (!q) return true;
    return m.naam.toLowerCase().includes(q) || dagen.some((d, i) => cel(m, d, i).label.toLowerCase().includes(q));
  });
  const volgorde = GROEPEN.flatMap((g) => zichtbaar.filter((m) => m.groep === g.id));
  const aantalFilters = (filters.groep !== "alle" ? 1 : 0) + (filters.og ? 1 : 0) + (filters.bv ? 1 : 0);

  const telling = dagen.map((d, i) => dagTelling(p.medewerkers.map((m) => cel(m, d, i))));
  const labelVan = (w: Invulling) => {
    const og = w.opdrachtgeverId ? ogById.get(w.opdrachtgeverId) : undefined;
    return `${w.opdrachtgeverId ? (og ? opdrachtgeverLabel(og) : "Ingezet") : STATUS[w.status].label}${w.notitie ? ` (${w.notitie})` : ""}`;
  };

  const log = (omschrijving: string, tabel: string, recordId?: string) => logWijziging(supabase, tabel, omschrijving, recordId);

  async function slaVakOp(mw: Medewerker, datum: string, w: Invulling | null) {
    const k = sleutel(mw.id, datum);
    const oud = vakken.get(k);
    const i = dagen.indexOf(datum);
    const lang = dagInfo(datum, i).lang.toLowerCase();
    const opnieuw = () => slaVakOp(mw, datum, w);
    const mislukt = `Opslaan lukte niet. Je wijziging bij ${mw.naam} (${dagInfo(datum, i).kort}) staat nog niet in de planning.`;
    setPaneel(null);
    const vorige = new Map(vakken);

    if (w === null) {
      if (!oud) return;
      const next = new Map(vakken); next.delete(k); setVakken(next);
      const { error } = await supabase.from("vakken").delete().eq("id", oud.id);
      if (error) { setVakken(vorige); melding(mislukt, true, opnieuw); return; }
      await log(`${mw.naam} ${lang}: leeggemaakt`, "vakken", oud.id);
      melding("Vak leeggemaakt");
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const rij = { medewerker_id: mw.id, datum, status: w.status, opdrachtgever_id: w.status === "werk" ? w.opdrachtgeverId : null, notitie: w.notitie.trim() || null, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() };
    setVakken(new Map(vakken).set(k, { id: oud?.id ?? "nieuw", ...rij }));
    const { data, error } = await supabase.from("vakken").upsert(rij, { onConflict: "medewerker_id,datum" }).select(VAK_KOLOMMEN).single();
    if (error || !data) { setVakken(vorige); melding(mislukt, true, opnieuw); return; }
    setVakken((m) => new Map(m).set(k, data as Vak));
    await log(`${mw.naam} ${lang}: ${labelVan({ ...w, opdrachtgeverId: rij.opdrachtgever_id })}`, "vakken", data.id);
    melding("Opgeslagen");
  }

  /** Meerdere vakken tegelijk invullen (of leegmaken met `null`). */
  async function slaMeerdereOp(keys: string[], w: Invulling | null) {
    setPaneel(null);
    const vorige = new Map(vakken);
    const opnieuw = () => slaMeerdereOp(keys, w);
    if (w === null) {
      const ids = keys.map((k) => vakken.get(k)?.id).filter((id): id is string => !!id && id !== "nieuw");
      if (!ids.length) { setSelectie(new Set()); return; }
      const next = new Map(vakken); keys.forEach((k) => next.delete(k)); setVakken(next);
      const { error } = await supabase.from("vakken").delete().in("id", ids);
      if (error) { setVakken(vorige); melding("Leegmaken lukte niet. De vakken staan nog in de planning.", true, opnieuw); return; }
      setSelectie(new Set());
      await log(`${ids.length} vakken leeggemaakt in week ${p.week}`, "vakken");
      melding(`${ids.length} ${ids.length === 1 ? "vak" : "vakken"} leeggemaakt`);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const nu = new Date().toISOString();
    const rijen = keys.map((k) => {
      const [medewerker_id, datum] = k.split("|");
      return { medewerker_id, datum, status: w.status, opdrachtgever_id: w.status === "werk" ? w.opdrachtgeverId : null, notitie: w.notitie.trim() || null, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: nu };
    });
    const next = new Map(vakken);
    rijen.forEach((r) => next.set(sleutel(r.medewerker_id, r.datum), { id: vakken.get(sleutel(r.medewerker_id, r.datum))?.id ?? "nieuw", ...r }));
    setVakken(next);
    const { data, error } = await supabase.from("vakken").upsert(rijen, { onConflict: "medewerker_id,datum" }).select(VAK_KOLOMMEN);
    if (error || !data) { setVakken(vorige); melding("Opslaan lukte niet. Je wijzigingen staan nog niet in de planning.", true, opnieuw); return; }
    setVakken((m) => { const n = new Map(m); (data as Vak[]).forEach((v) => n.set(sleutel(v.medewerker_id, v.datum), v)); return n; });
    setSelectie(new Set());
    const namen = [...new Set(rijen.map((r) => mwById.get(r.medewerker_id)?.naam ?? "?"))];
    await log(`${namen.length > 2 ? `${namen.length} medewerkers` : namen.join(" en ")}, ${rijen.length} vakken: ${labelVan(w)}`, "vakken");
    melding(`${rijen.length} ${rijen.length === 1 ? "vak" : "vakken"} opgeslagen`);
  }

  async function slaOpmerkingOp(mw: Medewerker, tekst: string) {
    const oud = opmerkingen.get(mw.id);
    const vorige = new Map(opmerkingen);
    setPaneel(null);
    if (!tekst.trim()) {
      if (!oud) return;
      const next = new Map(opmerkingen); next.delete(mw.id); setOpmerkingen(next);
      const { error } = await supabase.from("week_opmerkingen").delete().eq("id", oud.id);
      if (error) { setOpmerkingen(vorige); melding("Opslaan lukte niet.", true, () => slaOpmerkingOp(mw, tekst)); return; }
      await log(`${mw.naam}: opmerking week ${p.week} verwijderd`, "week_opmerkingen", oud.id);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const rij = { medewerker_id: mw.id, jaar: p.jaar, week: p.week, tekst: tekst.trim(), gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: new Date().toISOString() };
    setOpmerkingen(new Map(opmerkingen).set(mw.id, { id: oud?.id ?? "nieuw", medewerker_id: mw.id, tekst: rij.tekst }));
    const q2 = oud
      ? supabase.from("week_opmerkingen").update(rij).eq("id", oud.id).select("id, medewerker_id, tekst").single()
      : supabase.from("week_opmerkingen").insert(rij).select("id, medewerker_id, tekst").single();
    const { data, error } = await q2;
    if (error || !data) { setOpmerkingen(vorige); melding(`Opslaan lukte niet. De opmerking bij ${mw.naam} staat nog niet in de planning.`, true, () => slaOpmerkingOp(mw, tekst)); return; }
    setOpmerkingen((m) => new Map(m).set(mw.id, data as WeekOpmerking));
    await log(`${mw.naam}: opmerking "${rij.tekst}"`, "week_opmerkingen", data.id);
    melding("Opgeslagen");
  }

  const vorigeMaandag = plusDagen(p.maandag, -7);
  const vorigeIso = isoWeek(vorigeMaandag);

  async function vorigeWeekKopieren(zonderAfwezigheid: boolean, metOpmerkingen: boolean) {
    const { data: oud, error } = await supabase.from("vakken").select(VAK_KOLOMMEN).gte("datum", vorigeMaandag).lte("datum", plusDagen(vorigeMaandag, 6));
    if (error) { melding("Kopiëren lukte niet. Er is niets veranderd.", true, () => vorigeWeekKopieren(zonderAfwezigheid, metOpmerkingen)); return; }
    const { data: auth } = await supabase.auth.getUser();
    const nu = new Date().toISOString();
    const rijen = (oud as Vak[])
      .filter((v) => mwById.has(v.medewerker_id) && !(zonderAfwezigheid && AFWEZIG_NIET_KOPIEREN.includes(v.status)))
      .map((v) => ({ medewerker_id: v.medewerker_id, datum: plusDagen(v.datum, 7), status: v.status, opdrachtgever_id: v.opdrachtgever_id, notitie: v.notitie, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: nu }));
    let aantalOpm = 0;
    if (rijen.length) {
      const { data, error: e2 } = await supabase.from("vakken").upsert(rijen, { onConflict: "medewerker_id,datum" }).select(VAK_KOLOMMEN);
      if (e2 || !data) { melding("Kopiëren lukte niet. Er is niets veranderd.", true, () => vorigeWeekKopieren(zonderAfwezigheid, metOpmerkingen)); return; }
      setVakken((m) => { const n = new Map(m); (data as Vak[]).forEach((v) => n.set(sleutel(v.medewerker_id, v.datum), v)); return n; });
    }
    if (metOpmerkingen) {
      const { data: opm } = await supabase.from("week_opmerkingen").select("medewerker_id, tekst").eq("jaar", vorigeIso.jaar).eq("week", vorigeIso.week);
      const opmRijen = (opm ?? []).filter((o) => mwById.has(o.medewerker_id))
        .map((o) => ({ medewerker_id: o.medewerker_id, jaar: p.jaar, week: p.week, tekst: o.tekst, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: nu }));
      if (opmRijen.length) {
        const { data, error: e3 } = await supabase.from("week_opmerkingen").upsert(opmRijen, { onConflict: "medewerker_id,jaar,week" }).select("id, medewerker_id, tekst");
        if (e3 || !data) melding("De vakken zijn gekopieerd, de opmerkingen niet.", true);
        else { aantalOpm = data.length; setOpmerkingen((m) => { const n = new Map(m); (data as WeekOpmerking[]).forEach((o) => n.set(o.medewerker_id, o)); return n; }); }
      }
    }
    if (!rijen.length && !aantalOpm) { melding(`Week ${vorigeIso.week} heeft niets om te kopiëren.`); return; }
    await log(`Week ${vorigeIso.week} gekopieerd naar week ${p.week}: ${rijen.length} vakken${aantalOpm ? `, ${aantalOpm} opmerkingen` : ""}`, "vakken");
    melding(`${rijen.length} vakken gekopieerd${aantalOpm ? ` en ${aantalOpm} opmerkingen` : ""}`);
  }

  /** Lege vakken (geen vak, geen afwezigheid) op de dagen van iemands vaste inzet. */
  const vasteInzetRijen = p.medewerkers.flatMap((m) => {
    const v = geldigeVasteInzet(m.vaste_inzet);
    if (!v) return [];
    return v.dagen.map((i) => dagen[i]).filter((d) => !vakken.has(sleutel(m.id, d)) && !afwezigOp(m.id, d))
      .map((datum) => ({ medewerker_id: m.id, datum, status: v.status as VakStatus, opdrachtgever_id: v.opdrachtgever_id }));
  });
  const vasteInzetMedewerkers = new Set(vasteInzetRijen.map((r) => r.medewerker_id)).size || p.medewerkers.filter((m) => geldigeVasteInzet(m.vaste_inzet)).length;

  async function vasteInzetInvullen() {
    if (!vasteInzetRijen.length) return;
    const { data: auth } = await supabase.auth.getUser();
    const nu = new Date().toISOString();
    // ignoreDuplicates: een vak dat intussen door iemand anders is ingevuld, blijft staan.
    const { data, error } = await supabase.from("vakken")
      .upsert(vasteInzetRijen.map((r) => ({ ...r, notitie: null, gewijzigd_door: auth.user?.id ?? null, gewijzigd_op: nu })), { onConflict: "medewerker_id,datum", ignoreDuplicates: true })
      .select(VAK_KOLOMMEN);
    if (error || !data) { melding("Invullen lukte niet. Er is niets veranderd.", true, vasteInzetInvullen); return; }
    setVakken((m) => { const n = new Map(m); (data as Vak[]).forEach((v) => n.set(sleutel(v.medewerker_id, v.datum), v)); return n; });
    await log(`Vaste inzet ingevuld in week ${p.week}: ${data.length} vakken`, "vakken");
    melding(`${data.length} vakken ingevuld met de vaste inzet`);
  }

  // ---- Selecteren, kopiëren, plakken, toetsenbord ----
  const invullingVan = (k: string): Invulling | null => {
    const v = vakken.get(k);
    return v ? { status: v.status, opdrachtgeverId: v.opdrachtgever_id, notitie: v.notitie ?? "" } : null;
  };

  function kopieer(keys: string[]) {
    const w = keys.map(invullingVan).find(Boolean);
    if (!w) { melding("Kies een vak met inhoud om te kopiëren.", true); return; }
    setKlembord(w);
    melding(`Gekopieerd: ${labelVan(w)}`);
  }

  function klikVak(e: React.MouseEvent, mw: Medewerker, i: number) {
    const k = sleutel(mw.id, dagen[i]);
    if (e.ctrlKey || e.metaKey || e.shiftKey || selectie.size > 0) {
      const n = new Set(selectie);
      if (n.has(k)) n.delete(k); else n.add(k);
      setSelectie(n);
      return;
    }
    setPaneel({ soort: "vak", mw, dag: i });
  }

  function toetsVak(e: React.KeyboardEvent, mw: Medewerker, i: number) {
    const k = sleutel(mw.id, dagen[i]);
    const doel = selectie.size ? [...selectie] : [k];
    const r = volgorde.findIndex((m) => m.id === mw.id);
    const ga = (rij: number, kol: number) => {
      const m = volgorde[Math.max(0, Math.min(volgorde.length - 1, rij))];
      const d = Math.max(0, Math.min(6, kol));
      if (m) document.querySelector<HTMLButtonElement>(`[data-vak="${m.id}|${weergave === "dag" ? dag : d}"]`)?.focus();
    };
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "ArrowRight" && weergave === "week") { e.preventDefault(); ga(r, i + 1); }
    else if (e.key === "ArrowLeft" && weergave === "week") { e.preventDefault(); ga(r, i - 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); ga(r + 1, i); }
    else if (e.key === "ArrowUp") { e.preventDefault(); ga(r - 1, i); }
    else if ((e.key === "Delete" || e.key === "Backspace") && p.magWijzigen) { e.preventDefault(); slaMeerdereOp(doel, null); }
    else if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); kopieer(doel); }
    else if (mod && e.key.toLowerCase() === "v" && p.magWijzigen) { e.preventDefault(); if (klembord) slaMeerdereOp(doel, klembord); else melding("Kopieer eerst een vak.", true); }
    else if (e.key === "Escape" && selectie.size) setSelectie(new Set());
  }

  function vakKnop(m: Medewerker, i: number) {
    const d = dagen[i];
    const c = cel(m, d, i);
    const k = sleutel(m.id, d);
    const gekozen = paneel?.soort === "vak" && paneel.mw.id === m.id && paneel.dag === i;
    return (
      <button
        type="button"
        key={d}
        data-vak={`${m.id}|${i}`}
        className={`vakcel${i >= 5 ? " weekend" : ""}${selectie.has(k) ? " geselecteerd" : ""}`}
        disabled={!p.magWijzigen}
        aria-pressed={selectie.size > 0 ? selectie.has(k) : undefined}
        onClick={(e) => klikVak(e, m, i)}
        onKeyDown={(e) => toetsVak(e, m, i)}
        aria-label={`${m.naam}, ${dagInfo(d, i).lang}: ${c.label || "leeg"}${c.sub ? ", " + c.sub : ""}${c.conflict ? ", ingepland tijdens afwezigheid" : ""}`}
      >
        <VakInhoud c={c} gekozen={gekozen} />
      </button>
    );
  }

  function naamCel(m: Medewerker) {
    return <>
      <button type="button" className="naam" onClick={() => setPaneel({ soort: "medewerker", mw: m })} title="Weekbericht en details">{m.naam}</button>
      {m.certificaten.length > 0 && (
        <span className="labels">{m.certificaten.map((c) => <span key={c} className={`label${/ADR/.test(c) ? " label-adr" : ""}`}>{c}</span>)}</span>
      )}
    </>;
  }

  const meta = p.laadFout
    ? "De planning kon niet worden geladen."
    : !p.magWijzigen
      ? `Je kunt deze planning bekijken, maar niet wijzigen${p.laatstGewijzigd ? ` · laatst gewijzigd door ${p.laatstGewijzigd.door}, ${tijdstipNL(p.laatstGewijzigd.tijdstip)}` : ""}`
      : vakken.size === 0 ? "Nog niets gepland deze week"
      : p.laatstGewijzigd ? `Laatst gewijzigd door ${p.laatstGewijzigd.door} · ${tijdstipNL(p.laatstGewijzigd.tijdstip)}` : "Nog geen wijzigingen";

  const exportQuery = `week=${weekParam(p.maandag)}&groep=${filters.groep}${filters.og ? `&og=${filters.og}` : ""}${filters.bv ? `&bv=${encodeURIComponent(filters.bv)}` : ""}`;
  const leeg = vakken.size === 0 && !p.laadFout && p.medewerkers.length > 0;
  const paneelMw = paneel && "mw" in paneel ? paneel.mw : null;
  const vandaagIndex = dagIndex(vandaag);

  return (
    <main className="pagina">
      <div className="kop">
        <div>
          <div className="kop-titel">
            <h1 className="machina">Weekplanning</h1>
            {!p.magWijzigen && <span className="label-alleen-lezen"><Icoon naam="slot" maat={14} dik={2.4} />Alleen lezen</span>}
          </div>
          <div className="kop-meta">{meta}</div>
        </div>
        <WeekKiezer pad="/" maandag={p.maandag} />
      </div>

      {p.laadFout && <div className="melding melding-fout" role="alert" style={{ maxWidth: "none" }}><strong>Laden is niet gelukt</strong>{p.laadFout}</div>}

      <div className="werkbalk">
        <div className="seg" role="group" aria-label="Weergave">
          <button type="button" aria-pressed={weergave === "week"} onClick={() => setWeergave("week")}>Week</button>
          <button type="button" aria-pressed={weergave === "dag"} onClick={() => setWeergave("dag")}>Dag</button>
        </div>
        <label className="zoekveld">
          <Icoon naam="zoek" />
          <input type="search" aria-label="Zoeken" placeholder="Zoek medewerker of opdrachtgever" value={zoek} onChange={(e) => setZoek(e.target.value)} />
        </label>
        <div className="menu-anker">
          <button type="button" className="knop" aria-expanded={filterOpen} aria-haspopup="dialog" onClick={() => setFilterOpen(!filterOpen)}
            style={filterOpen ? { boxShadow: "0 0 0 3px var(--geel)" } : undefined}>
            <Icoon naam="filter" />Filters{aantalFilters > 0 && <span className="filter-teller">{aantalFilters}</span>}
          </button>
          {filterOpen && (
            <>
              <div className="menu-sluiter" onClick={() => setFilterOpen(false)} />
              <div className="menu filter-menu" role="dialog" aria-label="Filters" onKeyDown={(e) => { if (e.key === "Escape") setFilterOpen(false); }}>
                <label className="veld"><span>Groep</span>
                  <select className="invoer" value={filters.groep} onChange={(e) => setFilters({ ...filters, groep: e.target.value })}>
                    <option value="alle">Alle groepen</option>
                    {GROEPEN.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </label>
                <label className="veld"><span>Opdrachtgever</span>
                  <select className="invoer" value={filters.og} onChange={(e) => setFilters({ ...filters, og: e.target.value })}>
                    <option value="">Alle opdrachtgevers</option>
                    {p.opdrachtgevers.filter((o) => !o.verborgen || o.id === filters.og).map((o) => <option key={o.id} value={o.id}>{opdrachtgeverLabel(o)}</option>)}
                  </select>
                </label>
                <label className="veld"><span>BV</span>
                  <select className="invoer" value={filters.bv} onChange={(e) => setFilters({ ...filters, bv: e.target.value })}>
                    <option value="">Alle BV&apos;s</option>
                    {bvs.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
                <div className="kopieer-knoppen verdeeld">
                  <button type="button" className="knop-link" onClick={() => setFilters(GEEN_FILTER)}>Wissen</button>
                  <button type="button" className="knop knop-zwart" onClick={() => setFilterOpen(false)}>Klaar</button>
                </div>
              </div>
            </>
          )}
        </div>
        <button type="button" className="icoonknop" aria-label="Legenda" title="Legenda" onClick={() => setLegenda(true)}><Icoon naam="vraag" maat={20} /></button>
        <div style={{ flexGrow: 1 }} />
        {p.magWijzigen && <VasteInzetKnop week={p.week} aantalVakken={vasteInzetRijen.length} aantalMedewerkers={vasteInzetMedewerkers} open={vasteOpen} setOpen={(o) => { setVasteOpen(o); if (o) setKopieerOpen(false); }} onInvullen={vasteInzetInvullen} />}
        {p.magWijzigen && <WeekKopieren week={p.week} vorigeWeek={vorigeIso.week} ingevuld={vakken.size} open={kopieerOpen} setOpen={(o) => { setKopieerOpen(o); if (o) setVasteOpen(false); }} onKopieer={vorigeWeekKopieren} />}
        <ExportMenu
          uitleg={`Week ${p.week}${aantalFilters ? ", met de filters die nu aan staan" : ""}.`}
          keuzes={[
            { titel: "PDF, A4 liggend", sub: "hele week op één pagina", href: `/afdruk/week?${exportQuery}&stand=liggend`, soort: "liggend" },
            { titel: "PDF, A4 staand", sub: "compact, met opmerkingen eronder", href: `/afdruk/week?${exportQuery}&stand=staand`, soort: "staand" },
            { titel: "Excel", sub: "om verder te rekenen of te delen", onClick: () => weekNaarExcel({ ...p, medewerkers: aantalFilters ? zichtbaar : p.medewerkers, vakken: [...vakken.values()], opmerkingen: [...opmerkingen.values()], groep: "alle" }), soort: "excel" },
          ]}
        />
      </div>

      {leeg && p.magWijzigen && (
        <section className="leeg-banner">
          <div>
            <b>Week {p.week} is nog leeg</b>
            <span>Neem week {vorigeIso.week} over of vul de vaste inzet in. Je kunt ook direct op een vak klikken.</span>
          </div>
          <button type="button" className="knop knop-zwart" onClick={() => { setKopieerOpen(true); setVasteOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Week {vorigeIso.week} kopiëren</button>
          <button type="button" className="knop" onClick={() => { setVasteOpen(true); setKopieerOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Vaste inzet invullen</button>
        </section>
      )}

      {weergave === "week" ? (
        <section className="rooster" aria-label={`Planning week ${p.week}`}>
          <div className="rooster-kop">
            <div className="rrij">
              <span>Medewerker</span>
              {dagen.map((d, i) => {
                const info = dagInfo(d, i);
                return <span key={d} className={`dagkop${d === vandaag ? " vandaag" : ""}`}><span>{info.kort}</span><b>{info.nummer}</b></span>;
              })}
              <span>Opmerking</span>
            </div>
            <div className="rrij bezetting-rij">
              <span>Bezetting</span>
              {telling.map((t, i) => (
                <span key={i}><span><strong>{t.inzet}</strong> in</span>{t.open > 0 && <span className="open"><span className="bolletje" /><strong>{t.open}</strong> open</span>}</span>
              ))}
              <span />
            </div>
          </div>
          {GROEPEN.map((g) => {
            const lijst = zichtbaar.filter((m) => m.groep === g.id);
            if (!lijst.length) return null;
            return (
              <div key={g.id}>
                <div className="groepkop"><span className="bolletje" />{g.label}<small>{lijst.length}</small></div>
                {lijst.map((m) => {
                  const opm = opmerkingen.get(m.id);
                  return (
                    <div key={m.id} className="rrij mwrij">
                      <div className="naamcel">{naamCel(m)}</div>
                      {dagen.map((_, i) => vakKnop(m, i))}
                      <button type="button" className="opmerkingcel" disabled={!p.magWijzigen} onClick={() => setPaneel({ soort: "opmerking", mw: m })} aria-label={`Opmerking week ${p.week} voor ${m.naam}${opm ? `: ${opm.tekst}` : ""}`}>
                        {opm?.tekst ?? ""}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {zichtbaar.length === 0 && <div className="leeg-staat">Geen medewerkers gevonden{q || aantalFilters ? " met deze zoekterm of filters" : ""}.</div>}
        </section>
      ) : (
        <section className="dagweergave" aria-label="Dagplanning">
          <div className="dagtabs" role="tablist" aria-label="Dag">
            {dagen.map((d, i) => {
              const info = dagInfo(d, i);
              return <button key={d} type="button" role="tab" className={`dagtab${d === vandaag ? " vandaag" : ""}`} aria-selected={dag === i} onClick={() => setDag(i)}><span>{info.kort}</span><b>{info.nummer}</b></button>;
            })}
          </div>
          <div className="dagkop-groot">
            <h2 className="machina">{dagInfo(dagen[dag], dag).lang}</h2>
            <span>{telling[dag].inzet} ingezet · {telling[dag].open} open</span>
          </div>
          <div className="dagrij dagrij-kop"><span>Medewerker</span><span>Inzet</span><span>Opmerking week</span></div>
          {GROEPEN.map((g) => {
            const lijst = zichtbaar.filter((m) => m.groep === g.id);
            if (!lijst.length) return null;
            return (
              <div key={g.id}>
                <div className="groepkop"><span className="bolletje" />{g.label}</div>
                {lijst.map((m) => (
                  <div key={m.id} className="dagrij">
                    <div className="naamcel" style={{ padding: 0 }}>{naamCel(m)}</div>
                    {vakKnop(m, dag)}
                    <span style={{ fontSize: 14 }}>{opmerkingen.get(m.id)?.tekst ?? ""}</span>
                  </div>
                ))}
              </div>
            );
          })}
          {zichtbaar.length === 0 && <div className="leeg-staat">Geen medewerkers gevonden.</div>}
        </section>
      )}

      {selectie.size > 0 && !paneel && (
        <div className="selectiebalk" role="toolbar" aria-label="Selectie">
          <span>{selectie.size} {selectie.size === 1 ? "vak" : "vakken"} geselecteerd</span>
          <button type="button" className="knop knop-zwart" onClick={() => setPaneel({ soort: "meerdere" })}>Bewerken</button>
          <button type="button" className="knop" onClick={() => kopieer([...selectie])}>Kopiëren</button>
          <button type="button" className="knop" disabled={!klembord} title={klembord ? `Plakken: ${labelVan(klembord)}` : "Kopieer eerst een vak"} onClick={() => klembord && slaMeerdereOp([...selectie], klembord)}>Plakken</button>
          <button type="button" className="knop" onClick={() => slaMeerdereOp([...selectie], null)}>Leegmaken</button>
          <button type="button" className="icoonknop" aria-label="Selectie opheffen" onClick={() => setSelectie(new Set())}><Icoon naam="sluiten" /></button>
        </div>
      )}

      {paneel?.soort === "vak" && (() => {
        const datum = dagen[paneel.dag];
        const a = afwezigOp(paneel.mw.id, datum);
        return (
          <VakPaneel
            key={`${paneel.mw.id}-${paneel.dag}`}
            boven={`Week ${p.week} · ${GROEPEN.find((g) => g.id === paneel.mw.groep)?.label ?? ""}`}
            titel={paneel.mw.naam}
            sub={dagInfo(datum, paneel.dag).lang.toLowerCase()}
            standaard={paneel.mw.groep === "kantoor" ? "kantoor" : "werk"}
            huidig={invullingVan(sleutel(paneel.mw.id, datum))}
            afwezigTekst={a ? `${paneel.mw.naam.split(" ")[0]} heeft ${STATUS[a.soort].label.toLowerCase()} van ${periodeKort(a.van, a.tot_en_met)}. Wat je hier invult, geldt alleen voor deze dag.` : null}
            opdrachtgevers={p.opdrachtgevers}
            dagIndex={paneel.dag}
            onSluit={() => setPaneel(null)}
            onOpslaan={(w, ds) => {
              if (ds.length <= 1 && (ds[0] ?? paneel.dag) === paneel.dag) slaVakOp(paneel.mw, datum, w);
              else slaMeerdereOp((ds.length ? ds : [paneel.dag]).map((i) => sleutel(paneel.mw.id, dagen[i])), w);
            }}
            onAfwezigheid={() => setPaneel({ soort: "afwezigheid", mw: paneel.mw, datum })}
          />
        );
      })()}
      {paneel?.soort === "meerdere" && (() => {
        const mwIds = [...new Set([...selectie].map((k) => k.split("|")[0]))];
        return (
          <VakPaneel
            boven="Meerdere vakken"
            titel={`${selectie.size} vakken`}
            sub={`${mwIds.length === 1 ? mwById.get(mwIds[0])?.naam : `${mwIds.length} medewerkers`}, week ${p.week}`}
            standaard="werk"
            huidig={null}
            afwezigTekst={null}
            opdrachtgevers={p.opdrachtgevers}
            onSluit={() => setPaneel(null)}
            onOpslaan={(w) => slaMeerdereOp([...selectie], w)}
          />
        );
      })()}
      {paneel?.soort === "opmerking" && (
        <OpmerkingPaneel key={paneel.mw.id} mw={paneel.mw} week={p.week} tekst={opmerkingen.get(paneel.mw.id)?.tekst ?? ""} onSluit={() => setPaneel(null)} onOpslaan={(t) => slaOpmerkingOp(paneel.mw, t)} />
      )}
      {paneel?.soort === "medewerker" && paneelMw && (
        <MedewerkerWeekPaneel
          key={paneelMw.id}
          mw={paneelMw}
          week={p.week}
          maandag={p.maandag}
          cellen={dagen.map((d, i) => cel(paneelMw, d, i))}
          vakken={dagen.map((d) => vakken.get(sleutel(paneelMw.id, d)))}
          opdrachtgevers={ogById}
          ritten={p.ritten.filter((r) => r.chauffeur_id === paneelMw.id)}
          magWijzigen={p.magWijzigen}
          onSluit={() => setPaneel(null)}
          onAfwezigheid={() => setPaneel({ soort: "afwezigheid", mw: paneelMw, datum: dagen[Math.max(0, dagen.indexOf(vandaag))] })}
          onMelding={(t, fout) => melding(t, fout)}
        />
      )}
      {paneel?.soort === "afwezigheid" && (() => {
        const bestaand = afwezigOp(paneel.mw.id, paneel.datum) ?? null;
        const i = dagen.indexOf(paneel.datum);
        return (
          <AfwezigheidPaneel
            medewerkers={[paneel.mw]}
            standaardMedewerker={paneel.mw.id}
            bestaand={bestaand}
            standaardVan={paneel.datum}
            onSluit={() => setPaneel(null)}
            onKlaar={(t, fout) => { if (!fout) setPaneel(null); melding(t, fout); router.refresh(); }}
            onAnders={bestaand && i >= 0 ? { label: `Alleen ${dagInfo(paneel.datum, i).lang.toLowerCase()} anders plannen`, onClick: () => setPaneel({ soort: "vak", mw: paneel.mw, dag: i }) } : undefined}
          />
        );
      })()}
      {legenda && <Legenda vandaag={`${dagInfo(vandaag, vandaagIndex).kort} ${Number(vandaag.slice(8))}`} onSluit={() => setLegenda(false)} />}
      <Toast melding={toastMelding} sluit={sluitToast} />
    </main>
  );
}

function OpmerkingPaneel(props: { mw: Medewerker; week: number; tekst: string; onSluit: () => void; onOpslaan: (t: string) => void }) {
  const [tekst, setTekst] = useState(props.tekst);
  return (
    <PaneelSchil
      boven={`Week ${props.week}`}
      titel={props.mw.naam}
      sub="opmerking bij deze week"
      onSluit={props.onSluit}
      voet={<PaneelVoet opslaan={() => props.onOpslaan(tekst)} onAnnuleren={props.onSluit} gevaar={props.tekst ? { label: "Verwijderen", onClick: () => props.onOpslaan("") } : undefined} />}
    >
      <div className="veld">
        <label className="veld-kop" htmlFor="opmerking">Opmerking</label>
        <textarea id="opmerking" className="invoer" value={tekst} onChange={(e) => setTekst(e.target.value)} maxLength={200} autoFocus placeholder="bijv. even weken LZV, vakantie t/m za 3-10" />
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: "20px" }}>De opmerking hoort bij deze week en staat in de laatste kolom van de planning. Met Vorige week kopiëren kun je hem meenemen.</p>
    </PaneelSchil>
  );
}
