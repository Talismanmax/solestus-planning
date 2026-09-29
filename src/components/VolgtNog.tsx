export default function VolgtNog({ titel, tekst }: { titel: string; tekst: string }) {
  return (
    <main className="pagina">
      <div className="kop"><h1 className="machina">{titel}</h1></div>
      <div className="leeg-staat">
        <p style={{ margin: 0, fontWeight: 700 }}>Dit scherm wordt nu gebouwd.</p>
        <p style={{ margin: "6px 0 0" }}>{tekst}</p>
      </div>
    </main>
  );
}
