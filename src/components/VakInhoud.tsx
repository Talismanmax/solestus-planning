import type { Cel } from "@/lib/planning";

/** Inhoud van één vak in het rooster (kleur, label, notitie, conflict-teken). */
export default function VakInhoud({ c, gekozen = false }: { c: Cel; gekozen?: boolean }) {
  return (
    <span className={`vak${c.open ? " open" : ""}${c.periode ? " periode" : ""}${gekozen ? " gekozen" : ""}`} style={c.open ? undefined : { background: c.bg, color: c.fg }}>
      <span className="vak-label">{c.open && <span className="bolletje" />}{c.label}</span>
      {c.sub && <span className="vak-sub">{c.sub}</span>}
      {c.conflict && <span className="conflict" title="Ingepland tijdens afwezigheid" aria-hidden="true">!</span>}
    </span>
  );
}
