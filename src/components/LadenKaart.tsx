/** Laadstaat van een pagina: de titel, een lege kaart en een paar grijze regels. */
export default function LadenKaart({ titel, metKaart = true, regels = 8 }: { titel: string; metKaart?: boolean; regels?: number }) {
  return (
    <main className="pagina" aria-busy="true">
      <div className="kop">
        <div>
          <div className="kop-titel"><h1 className="machina">{titel}</h1></div>
          <div className="kop-meta">Laden…</div>
        </div>
      </div>
      {metKaart && <div className="kaart" style={{ height: 120 }} />}
      <div className="kaart" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: regels }, (_, i) => <span key={i} className="skelet" style={{ height: 14, width: `${60 + ((i * 17) % 35)}%` }} />)}
      </div>
    </main>
  );
}
