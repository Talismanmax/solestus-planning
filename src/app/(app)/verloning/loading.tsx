/** Laadstaat: titel en een leeg rooster. */
export default function Laden() {
  return (
    <main className="pagina" aria-busy="true">
      <div className="kop">
        <div>
          <div className="kop-titel"><h1 className="machina">Verloning</h1></div>
          <div className="kop-meta">Laden…</div>
        </div>
      </div>
      <div className="kaart" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: 10 }, (_, i) => <span key={i} className="skelet" style={{ height: 14, width: `${60 + ((i * 17) % 35)}%` }} />)}
      </div>
    </main>
  );
}
