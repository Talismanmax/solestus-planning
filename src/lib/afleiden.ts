import type { Vak, VasteInzet } from "@/lib/planning";

/**
 * Vaste inzet afleiden uit de afgelopen weken: per medewerker de meest voorkomende inzet
 * (opdrachtgever, kantoor of thuiswerk) en de weekdagen waarop die minstens `drempel` keer voorkwam.
 */
export function leidVasteInzetAf(vakken: Vak[], drempel = 3): Map<string, VasteInzet> {
  const perMw = new Map<string, Vak[]>();
  for (const v of vakken) {
    if (!(v.status === "werk" && v.opdrachtgever_id) && v.status !== "kantoor" && v.status !== "thuiswerk") continue;
    perMw.set(v.medewerker_id, [...(perMw.get(v.medewerker_id) ?? []), v]);
  }
  const uit = new Map<string, VasteInzet>();
  for (const [mw, lijst] of perMw) {
    const sleutel = (v: Vak) => `${v.status}|${v.opdrachtgever_id ?? ""}`;
    const telling = new Map<string, number>();
    lijst.forEach((v) => telling.set(sleutel(v), (telling.get(sleutel(v)) ?? 0) + 1));
    const [beste] = [...telling].sort((a, b) => b[1] - a[1])[0];
    const perDag = [0, 0, 0, 0, 0, 0, 0];
    lijst.filter((v) => sleutel(v) === beste).forEach((v) => { perDag[(new Date(v.datum + "T00:00:00Z").getUTCDay() + 6) % 7]++; });
    const dagen = perDag.map((n, i) => (n >= drempel ? i : -1)).filter((i) => i >= 0);
    if (!dagen.length) continue;
    const [status, og] = beste.split("|");
    uit.set(mw, { status: status as VasteInzet["status"], opdrachtgever_id: og || null, dagen });
  }
  return uit;
}
