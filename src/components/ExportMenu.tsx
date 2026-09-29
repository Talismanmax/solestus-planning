"use client";

import { useState } from "react";
import Icoon from "./Icoon";

type Keuze = { titel: string; sub: string; soort: "liggend" | "staand" | "excel" } & ({ href: string } | { onClick: () => Promise<void> });

const SoortIcoon = ({ soort }: { soort: Keuze["soort"] }) =>
  soort === "excel"
    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M4 15h16M10 4v16" /></svg>
    : <span className={`export-blad export-${soort}`} aria-hidden="true" />;

/** Knop "Exporteren" met een menu. PDF's openen een afdrukpagina in een nieuw tabblad; Excel wordt direct gedownload. */
export default function ExportMenu({ uitleg, keuzes }: { uitleg: string; keuzes: Keuze[] }) {
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(false);

  return (
    <div className="menu-anker">
      <button type="button" className="knop knop-zwart" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} disabled={bezig} style={open ? { boxShadow: "0 0 0 3px var(--geel)" } : undefined}>
        <Icoon naam="download" />
        {bezig ? "Bezig…" : "Exporteren"}
        <Icoon naam="omlaag" maat={16} />
      </button>
      {open && (
        <>
          <div className="menu-sluiter" onClick={() => setOpen(false)} />
          <div className="menu export-menu" role="menu" aria-label="Exporteren" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
            <span className="export-uitleg">{uitleg}{fout && <strong style={{ color: "var(--fout)" }}> Exporteren is niet gelukt.</strong>}</span>
            {keuzes.map((k) => {
              const inhoud = <><span className="export-icoon"><SoortIcoon soort={k.soort} /></span><span><b>{k.titel}</b><small>{k.sub}</small></span></>;
              return "href" in k
                ? <a key={k.titel} role="menuitem" className="export-keuze" href={k.href} target="_blank" rel="noopener" onClick={() => setOpen(false)}>{inhoud}</a>
                : <button key={k.titel} type="button" role="menuitem" className="export-keuze" onClick={async () => {
                    setOpen(false); setBezig(true); setFout(false);
                    try { await k.onClick(); } catch { setFout(true); setOpen(true); } finally { setBezig(false); }
                  }}>{inhoud}</button>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
