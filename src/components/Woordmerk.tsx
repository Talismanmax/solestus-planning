/** Officieel Solestus-woordmerk (zwart), uit het Solestus design system. */
export default function Woordmerk({ hoogte = 20, payoff = false }: { hoogte?: number; payoff?: boolean }) {
  return payoff
    ? <img className="woordmerk" src="/logo/woordmerk-payoff.svg" alt="Solestus leert je kennen" style={{ width: hoogte, height: "auto", display: "block" }} />
    : <img className="woordmerk" src="/logo/woordmerk.svg" alt="Solestus" style={{ height: hoogte, width: "auto", display: "block" }} />;
}
