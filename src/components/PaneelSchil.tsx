export default function PaneelSchil({ boven, titel, sub, onSluit, children, voet }: { boven: string; titel: string; sub: string; onSluit: () => void; children: React.ReactNode; voet: React.ReactNode }) {
  return (
    <>
      <div className="paneel-achter" onClick={onSluit} />
      <aside className="paneel" role="dialog" aria-label={titel} onKeyDown={(e) => { if (e.key === "Escape") onSluit(); }}>
        <div className="paneel-kop">
          <div>
            <div style={{ fontSize: 13 }}>{boven}</div>
            <h2 className="machina">{titel}</h2>
            <div style={{ fontSize: 14 }}>{sub}</div>
          </div>
          <button type="button" className="icoonknop" onClick={onSluit} aria-label="Sluiten">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="paneel-inhoud">{children}</div>
        <div className="paneel-voet">{voet}</div>
      </aside>
    </>
  );
}
