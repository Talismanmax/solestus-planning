"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icoon from "./Icoon";
import ThemaKeuze from "./ThemaKeuze";
import WijzigingenPaneel from "./WijzigingenPaneel";
import Woordmerk from "./Woordmerk";

const LINKS = [
  { href: "/", label: "Weekplanning", icoon: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 11h16" /></> },
  { href: "/scania", label: "Scania-ritten", icoon: <><path d="M2 6h12v10H2z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="6.5" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></> },
  { href: "/overzicht", label: "Overzicht", icoon: <path d="M6 20V11M12 20V5M18 20v-6M3 20h18" /> },
  { href: "/stamgegevens", label: "Stamgegevens", icoon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2" /></> },
];

export default function Navigatiebalk({ naam, email, rol, wijzigingenDezeWeek }: { naam: string; email: string; rol: "planner" | "lezer"; wijzigingenDezeWeek: number }) {
  const pad = usePathname();
  const [open, setOpen] = useState(false);
  const [wijzigingen, setWijzigingen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const klik = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const toets = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", klik);
    document.addEventListener("keydown", toets);
    return () => { document.removeEventListener("mousedown", klik); document.removeEventListener("keydown", toets); };
  }, [open]);

  const woorden = naam.trim().split(/\s+/);
  const initialen = (woorden.length > 1 ? woorden[0][0] + woorden[woorden.length - 1][0] : naam.slice(0, 2)).toUpperCase();
  const rolLabel = rol === "planner" ? "Planner" : "Alleen lezen";

  return (
    <header className="nav">
      <Link href="/" className="nav-merk" aria-label="Solestus Planning, naar weekplanning">
        <Woordmerk hoogte={18} />
        <span className="zilla">planning</span>
      </Link>
      <nav aria-label="Hoofdmenu" className="nav-links">
        {LINKS.map((l) => {
          const actief = l.href === "/" ? pad === "/" : pad.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className="nav-link" aria-current={actief ? "page" : undefined}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{l.icoon}</svg>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ flexGrow: 1 }} />
      <button type="button" className="nav-wijzigingen" onClick={() => setWijzigingen(true)} aria-label={`Wijzigingen, ${wijzigingenDezeWeek} deze week`}>
        <Icoon naam="geschiedenis" />
        Wijzigingen
        {wijzigingenDezeWeek > 0 && <span className="teller">{wijzigingenDezeWeek > 99 ? "99+" : wijzigingenDezeWeek}</span>}
      </button>
      <div className="profiel" ref={ref}>
        <button type="button" className="profiel-knop" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
          <span className="avatar machina">{initialen}</span>
          <span className="stapel-8" style={{ gap: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{naam}</span>
            <span style={{ fontSize: 12 }}>{rolLabel} · Solestus</span>
          </span>
          <Icoon naam={open ? "omhoog" : "omlaag"} />
        </button>
        {open && (
          <div role="menu" aria-label="Profiel" className="menu">
            <div className="menu-kop">
              <span style={{ fontSize: 15, fontWeight: 700 }}>{naam}</span>
              <span>{email}</span>
              <span>{rolLabel} · Solestus</span>
            </div>
            <ThemaKeuze />
            <form action="/uitloggen" method="post">
              <button type="submit" role="menuitem" className="menu-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8l-4 4 4 4M6 12h10" /></svg>
                Uitloggen
              </button>
            </form>
          </div>
        )}
      </div>
      {wijzigingen && <WijzigingenPaneel onSluit={() => setWijzigingen(false)} />}
    </header>
  );
}
