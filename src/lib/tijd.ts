// Tijden in de planning zijn altijd Nederlandse tijd (Europe/Amsterdam).
import { DAG_KORT, dagIndex } from "@/lib/planning";
const TZ = "Europe/Amsterdam";

const opmaak = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, ...o }).format(d);

function delen(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { j: g("year"), m: g("month"), d: g("day"), u: g("hour"), min: g("minute") };
}

/** ISO-tijdstip → "2026-09-28T09:00" in Nederlandse tijd (voor datetime-local). */
export function naarLokaal(iso: string): string {
  const x = delen(new Date(iso));
  return `${x.j}-${x.m}-${x.d}T${x.u}:${x.min}`;
}

/** "2026-09-28T09:00" (Nederlandse tijd) → ISO-tijdstip in UTC. */
export function naarIso(lokaal: string): string {
  const [dat, tijd] = lokaal.split("T");
  const [j, m, d] = dat.split("-").map(Number);
  const [u, mi] = tijd.split(":").map(Number);
  const gok = Date.UTC(j, m - 1, d, u, mi);
  // Verschil tussen UTC en Amsterdam op dat moment, twee keer voor zomer/wintertijd-grenzen.
  let t = gok;
  for (let i = 0; i < 2; i++) {
    const x = delen(new Date(t));
    const alsUtc = Date.UTC(+x.j, +x.m - 1, +x.d, +x.u, +x.min);
    t = gok - (alsUtc - t);
  }
  return new Date(t).toISOString();
}

const KORT_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "ma 09.00" (of "Mon 09.00" in het Engels) */
export function dagTijd(iso: string, taal: "nl" | "en" = "nl"): string {
  const x = delen(new Date(iso));
  const dag = dagIndex(`${x.j}-${x.m}-${x.d}`);
  return `${(taal === "en" ? KORT_EN : DAG_KORT)[dag]} ${x.u}.${x.min}`;
}

/** "09.00" */
export function tijd(iso: string): string {
  const x = delen(new Date(iso));
  return `${x.u}.${x.min}`;
}

/** "di 29 sep 2026 om 10.12" (Nederlandse tijd). */
export function gemaaktOp(d: Date = new Date()): string {
  const f = (o: Intl.DateTimeFormatOptions) => opmaak(d, o);
  return `${f({ weekday: "short" }).replace(".", "")} ${f({ day: "numeric", month: "short", year: "numeric" }).replace(".", "")} om ${f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(":", ".")}`;
}


/** "ma 28 sep 16:40" (Nederlandse tijd). */
export function tijdstipNL(ts: string) {
  return opmaak(new Date(ts), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "14 okt" (Nederlandse tijd). */
export function datumKort(ts: string) {
  return opmaak(new Date(ts), { day: "numeric", month: "short" }).replace(".", "");
}

/** "vandaag om 06.00", "gisteren om 18.00" of "ma 28 sep om 06.00". */
export function wanneer(ts: string) {
  const d = new Date(ts), nu = new Date();
  const datum = (x: Date) => opmaak(x, { year: "numeric", month: "2-digit", day: "2-digit" });
  const tijd = opmaak(d, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(":", ".");
  if (datum(d) === datum(nu)) return `vandaag om ${tijd}`;
  if (datum(d) === datum(new Date(nu.getTime() - 86400000))) return `gisteren om ${tijd}`;
  return `${opmaak(d, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "")} om ${tijd}`;
}
