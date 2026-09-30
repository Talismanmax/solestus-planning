import Icoon from "@/components/Icoon";
import { DAG_KORT } from "@/lib/planning";

const BREEDTES = ["132px", "108px", "148px", "118px"];

/** Laadstaat van de weekplanning, zoals in het design: kop en rooster als skelet. */
export default function Laden() {
  return (
    <main className="pagina" aria-busy="true">
      <div className="kop">
        <div>
          <div className="kop-titel"><h1 className="machina">Weekplanning</h1></div>
          <div className="kop-meta">Planning laden…</div>
        </div>
        <div className="weekkiezer" aria-hidden="true">
          <span className="weekkiezer-pijl"><Icoon naam="links" maat={20} /></span>
          <span className="weekkiezer-week"><b>Week …</b><small>&nbsp;</small></span>
          <span className="weekkiezer-pijl"><Icoon naam="rechts" maat={20} /></span>
        </div>
      </div>
      <section className="rooster" aria-label="Planning laden">
        <div className="rooster-kop">
          <div className="rrij">
            <span>Medewerker</span>
            {DAG_KORT.map((d) => <span key={d} className="dagkop"><span>{d}</span><b>&nbsp;</b></span>)}
            <span>Opmerking</span>
          </div>
          <div className="rrij bezetting-rij">
            <span>Bezetting</span>
            {Array.from({ length: 7 }, (_, i) => <span key={i}>– in</span>)}
            <span />
          </div>
        </div>
        {[["Chauffeurs NL", 4], ["Chauffeurs internationaal", 3], ["Kantoor", 2]].map(([g, n]) => (
          <div key={g}>
            <div className="groepkop"><span className="bolletje" />{g}</div>
            {Array.from({ length: n as number }, (_, r) => (
              <div key={r} className="rrij mwrij">
                <div className="naamcel" style={{ padding: "0 16px", gap: 6 }}>
                  <span className="skelet" style={{ width: BREEDTES[r % 4], height: 12 }} />
                  <span className="skelet" style={{ width: 48, height: 10, background: "var(--skelet)" }} />
                </div>
                {Array.from({ length: 7 }, (_, i) => <span key={i} className="vakcel"><span className="skelet-vak" /></span>)}
                <span />
              </div>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
