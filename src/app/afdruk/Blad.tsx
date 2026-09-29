import AfdrukBalk from "./AfdrukBalk";
import Woordmerk from "@/components/Woordmerk";

/** Eén A4-blad met kop (woordmerk, titel) en voet (gemaakt op, pay-off). */
export default function Blad({ stand, titel, sub, voet, children }: {
  stand: "liggend" | "staand"; titel: string; sub: React.ReactNode; voet: string; children: React.ReactNode;
}) {
  return (
    <>
      <style>{`@page { size: A4 ${stand === "liggend" ? "landscape" : "portrait"}; }`}</style>
      <AfdrukBalk titel={titel} />
      <article className={`blad blad-${stand}`}>
        <header className={`blad-kop blad-kop-${stand}`}>
          <div className="blad-merk"><Woordmerk hoogte={stand === "liggend" ? 18 : 17} /><span>Planning</span></div>
          <h1 className="machina">{titel}</h1>
          <div className="blad-sub">{sub}</div>
        </header>
        <div className="blad-inhoud">{children}</div>
        <footer className="blad-voet">
          <span>{voet}</span>
          <span className="zilla">Solestus leert je kennen</span>
          <span />
        </footer>
      </article>
    </>
  );
}
