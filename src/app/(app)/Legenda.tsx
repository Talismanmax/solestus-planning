"use client";

import { useEffect } from "react";
import Icoon from "@/components/Icoon";
import { STATUS, STATUS_VOLGORDE } from "@/lib/planning";

export default function Legenda({ vandaag, onSluit }: { vandaag: string; onSluit: () => void }) {
  useEffect(() => {
    const toets = (e: KeyboardEvent) => { if (e.key === "Escape") onSluit(); };
    document.addEventListener("keydown", toets);
    return () => document.removeEventListener("keydown", toets);
  }, [onSluit]);

  return (
    <div className="dialoog-achter" onClick={onSluit}>
      <section className="dialoog" role="dialog" aria-modal="true" aria-labelledby="legenda-titel" onClick={(e) => e.stopPropagation()}>
        <div className="dialoog-kop">
          <h2 id="legenda-titel" className="machina">Legenda</h2>
          <button type="button" className="icoonknop" onClick={onSluit} aria-label="Sluiten" autoFocus><Icoon naam="sluiten" maat={20} /></button>
        </div>
        <div className="stapel-12" style={{ gap: 10 }}>
          <h3>Statussen</h3>
          <div className="pillen">
            {STATUS_VOLGORDE.map((s) => (
              <span key={s} className="pil" style={{ height: 30, padding: "0 12px", background: STATUS[s].bg, color: STATUS[s].fg }}>
                {s === "werk" ? "Ingezet bij opdrachtgever" : STATUS[s].label}
              </span>
            ))}
          </div>
        </div>
        <div className="stapel-12" style={{ gap: 10 }}>
          <h3>Tekens in het rooster</h3>
          <div style={{ display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", gap: "10px 14px", alignItems: "center", fontSize: 14, lineHeight: "20px" }}>
            <span className="vak periode" style={{ minHeight: 32, background: STATUS.vakantie.bg, color: STATUS.vakantie.fg }}><span className="vak-label">Vakantie</span></span>
            <span>Cursief: afwezigheid uit een periode</span>
            <span className="vak" style={{ minHeight: 32, background: STATUS.werk.bg }}><span className="vak-label">Scania</span><span className="conflict">!</span></span>
            <span>Ingepland terwijl de medewerker afwezig is</span>
            <span className="vak open" style={{ minHeight: 32 }}><span className="vak-label"><span className="bolletje" />Open</span></span>
            <span>Werkdag zonder planning</span>
            <span className="vak" style={{ minHeight: 32, background: "var(--geel)", alignItems: "center" }}><span className="vak-label">{vandaag}</span></span>
            <span>Vandaag</span>
          </div>
        </div>
        <div className="stapel-12" style={{ gap: 10 }}>
          <h3>Sneltoetsen</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontSize: 14, lineHeight: "20px" }}>
            <span><strong>Shift- of Ctrl-klik</strong> meerdere vakken</span>
            <span><strong>Ctrl+C / Ctrl+V</strong> kopiëren en plakken</span>
            <span><strong>Pijltjes</strong> naar een ander vak</span>
            <span><strong>Delete</strong> vak leegmaken</span>
          </div>
        </div>
      </section>
    </div>
  );
}
