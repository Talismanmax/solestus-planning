// Tijden in de planning zijn altijd Nederlandse tijd (Europe/Amsterdam).
const TZ = "Europe/Amsterdam";

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

const KORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];

const KORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "ma 09.00" (of "Mon 09.00" in het Engels) */
export function dagTijd(iso: string, taal: "nl" | "en" = "nl"): string {
  const x = delen(new Date(iso));
  const dag = new Date(Date.UTC(+x.j, +x.m - 1, +x.d)).getUTCDay();
  return `${(taal === "en" ? KORT_EN : KORT)[dag]} ${x.u}.${x.min}`;
}

/** "09.00" */
export function tijd(iso: string): string {
  const x = delen(new Date(iso));
  return `${x.u}.${x.min}`;
}

/** Datum (yyyy-mm-dd) van een tijdstip in Nederlandse tijd. */
export function datumVan(iso: string): string {
  const x = delen(new Date(iso));
  return `${x.j}-${x.m}-${x.d}`;
}

/** "di 29 sep 2026 om 10.12" (Nederlandse tijd). */
export function gemaaktOp(d: Date = new Date()): string {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, ...o }).format(d);
  return `${f({ weekday: "short" }).replace(".", "")} ${f({ day: "numeric", month: "short", year: "numeric" }).replace(".", "")} om ${f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(":", ".")}`;
}
