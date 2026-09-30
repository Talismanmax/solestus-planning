import InlogKnop from "./InlogKnop";
import Icoon from "@/components/Icoon";
import Woordmerk from "@/components/Woordmerk";

const TEKSTEN = {
  inloggen: ["Welkom", "Log in met je Microsoft-account van Solestus.", "Inloggen met Microsoft"],
  uitgelogd: ["Je bent uitgelogd", "Tot de volgende keer. Wil je verder plannen, log dan opnieuw in.", "Opnieuw inloggen met Microsoft"],
  mislukt: ["Probeer het nog eens", "Log in met je Microsoft-account van Solestus.", "Opnieuw proberen"],
  verlopen: ["Je sessie is verlopen", "Je was een tijd niet actief. Log opnieuw in om verder te plannen.", "Opnieuw inloggen met Microsoft"],
} as const;

type Staat = keyof typeof TEKSTEN;

export default async function InloggenPagina({ searchParams }: { searchParams: Promise<{ staat?: string; volgende?: string }> }) {
  const { staat: s, volgende } = await searchParams;
  const staat: Staat = s && s in TEKSTEN ? (s as Staat) : "inloggen";
  const [titel, intro, knop] = TEKSTEN[staat];

  return (
    <main className="inlog">
      <section className="inlog-geel">
        <Woordmerk payoff hoogte={300} />
        <div style={{ flexGrow: 1 }} />
        <h1 className="machina inlog-slogan">Iedereen op de plek waar hij past.</h1>
      </section>
      <section className="inlog-formulier">
        <div className="stapel-8">
          <span className="pil-zwart machina">Solestus Planning</span>
          <h2 className="machina" style={{ fontSize: 36, margin: 0 }}>{titel}</h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: "24px" }}>{intro}</p>
        </div>

        {staat === "mislukt" && (
          <div role="alert" className="inlog-fout">
            <Icoon naam="fout" maat={20} />
            <div><strong style={{ fontSize: 15 }}>Inloggen is niet gelukt</strong><br />Microsoft kon je niet aanmelden. Gebruik je account van Solestus (eindigt op @solestus.com) en probeer het opnieuw.</div>
          </div>
        )}
        {staat === "uitgelogd" && (
          <div role="status" className="inlog-tip">
            <span className="inlog-tip-icoon"><Icoon naam="vink" maat={18} dik={2.4} /></span>
            <span>Werk je op een gedeelde computer? Sluit dan ook je browser, zodat je Microsoft-sessie stopt.</span>
          </div>
        )}

        <div>
          <InlogKnop label={knop} volgende={volgende} />
          <p className="inlog-hint">Je wordt doorgestuurd naar Microsoft. Daarna kom je terug in de planning.</p>
        </div>
      </section>
    </main>
  );
}
