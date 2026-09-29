import InlogKnop from "./InlogKnop";
import Woordmerk from "@/components/Woordmerk";

const TEKSTEN = {
  inloggen: ["Welkom", "Log in met je Microsoft-account van Solestus.", "Inloggen met Microsoft"],
  uitgelogd: ["Je bent uitgelogd", "Tot de volgende keer. Wil je verder plannen, log dan opnieuw in.", "Opnieuw inloggen met Microsoft"],
  mislukt: ["Probeer het nog eens", "Log in met je Microsoft-account van Solestus.", "Opnieuw proberen"],
  verlopen: ["Je sessie is verlopen", "Je bent een tijd niet actief geweest. Log opnieuw in om verder te gaan.", "Opnieuw inloggen met Microsoft"],
} as const;

type Staat = keyof typeof TEKSTEN;

export default async function InloggenPagina({ searchParams }: { searchParams: Promise<{ staat?: string }> }) {
  const { staat: s } = await searchParams;
  const staat: Staat = s && s in TEKSTEN ? (s as Staat) : "inloggen";
  const [titel, intro, knop] = TEKSTEN[staat];

  return (
    <main className="inlog">
      <section className="inlog-geel">
        <div className="inlog-merk">
          <Woordmerk hoogte={34} />
          <span className="zilla">leert je kennen</span>
        </div>
        <div style={{ flexGrow: 1 }} />
        <h1 className="machina inlog-slogan">Iedereen op de plek waar hij past.</h1>
      </section>
      <section className="inlog-formulier">
        <div className="stapel-8">
          <span className="pil-zwart machina">Solestus Planning</span>
          <h2 className="machina" style={{ fontSize: 36, margin: 0 }}>{titel}</h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", maxWidth: 440 }}>{intro}</p>
        </div>

        {staat === "mislukt" && (
          <div role="alert" className="melding melding-fout">
            <strong>Inloggen is niet gelukt</strong>
            Microsoft kon je niet aanmelden. Gebruik je account van Solestus (eindigt op @solestus.com) en probeer het opnieuw.
          </div>
        )}
        {staat === "uitgelogd" && (
          <div role="status" className="melding">
            Werk je op een gedeelde computer? Sluit dan ook je browser, zodat je Microsoft-sessie stopt.
          </div>
        )}

        <div className="stapel-12" style={{ maxWidth: 440 }}>
          <InlogKnop label={knop} />
          <span style={{ fontSize: 13, lineHeight: "19px" }}>Je wordt doorgestuurd naar Microsoft. Daarna kom je terug in de planning.</span>
        </div>
      </section>
    </main>
  );
}
