import Link from "next/link";
import Icoon from "./Icoon";
import { isoWeek, plusDagen, weekBereik, weekParam } from "@/lib/planning";

/** Witte kaart met vorige/volgende week; klik op de week zelf gaat naar deze week. */
export default function WeekKiezer({ pad, maandag }: { pad: string; maandag: string }) {
  const { week } = isoWeek(maandag);
  const url = (m: string) => `${pad}?week=${weekParam(m)}`;
  return (
    <div className="weekkiezer">
      <Link className="weekkiezer-pijl" href={url(plusDagen(maandag, -7))} aria-label="Vorige week"><Icoon naam="links" maat={20} /></Link>
      <Link className="weekkiezer-week" href={pad} title="Naar deze week">
        <b>Week {week}</b>
        <small>{weekBereik(maandag)}</small>
      </Link>
      <Link className="weekkiezer-pijl" href={url(plusDagen(maandag, 7))} aria-label="Volgende week"><Icoon naam="rechts" maat={20} /></Link>
    </div>
  );
}
