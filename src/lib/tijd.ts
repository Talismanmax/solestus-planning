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

/** "ma 09.00" */
export function dagTijd(iso: string): string {
  const x = delen(new Date(iso));
  const dag = new Date(Date.UTC(+x.j, +x.m - 1, +x.d)).getUTCDay();
  return `${KORT[dag]} ${x.u}.${x.min}`;
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
