/**
 * Tijdelijk woordmerk in de huisletter. Vervang door het officiële
 * SVG-bestand (solestus-woordmerk-zwart.svg) zodra dat in /public staat.
 */
export default function Woordmerk({ hoogte = 20 }: { hoogte?: number }) {
  return (
    <span className="machina" aria-label="Solestus" style={{ fontSize: hoogte * 1.15, lineHeight: 1, letterSpacing: "0.02em" }}>
      SOLESTUS
    </span>
  );
}
