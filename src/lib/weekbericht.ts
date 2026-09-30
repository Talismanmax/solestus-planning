import { DAG_KORT, MAAND, STATUS, TELEFOON, opdrachtgeverLabel, plusDagen, type Cel, type Opdrachtgever, type Vak, type VakStatus } from "@/lib/planning";
import { ritTekst, type Rit } from "@/lib/scania";

const EN_DAG = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EN_MAAND = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Engelse namen van de statussen voor het weekbericht. */
const STATUS_EN: Record<VakStatus, string> = {
  werk: "Working", kantoor: "Office", thuiswerk: "Working from home", opleiding: "Training", niet_ingezet: "Not scheduled",
  nbb: "Not available", thuis: "At home (rest)", vakantie: "Holiday", vrij: "Day off", ziek: "Sick", einde: "Assignment ended",
};

const datumLabel = (datum: string, i: number, taal: "nl" | "en") => {
  const d = new Date(datum + "T00:00:00Z");
  return taal === "en" ? `${EN_DAG[i]} ${d.getUTCDate()} ${EN_MAAND[d.getUTCMonth()]}` : `${DAG_KORT[i]} ${d.getUTCDate()} ${MAAND[d.getUTCMonth()]}`;
};

/** Bericht voor WhatsApp of sms met de planning van één medewerker voor een week. */
export function weekbericht(p: {
  naam: string; week: number; maandag: string; taal: "nl" | "en";
  cellen: Cel[]; vakken: (Vak | undefined)[]; opdrachtgevers: Map<string, Pick<Opdrachtgever, "naam" | "korte_naam">>; ritten: Rit[];
}): string {
  const en = p.taal === "en", voornaam = p.naam.split(" ")[0];
  const zo = plusDagen(p.maandag, 6);
  const bereik = `${datumLabel(p.maandag, 0, p.taal).slice(4)} – ${datumLabel(zo, 6, p.taal).slice(4)}`;
  const regels = [en ? `Hi ${voornaam},` : `Hoi ${voornaam},`, "", en ? `Your schedule for week ${p.week} (${bereik}):` : `Je planning voor week ${p.week} (${bereik}):`];
  p.cellen.forEach((c, i) => {
    const lab = datumLabel(plusDagen(p.maandag, i), i, p.taal);
    if (!c.status) { if (i < 5) regels.push(`${lab}: ${en ? "to be confirmed" : "volgt nog"}`); return; }
    const v = p.vakken[i];
    const og = v?.status === "werk" && v.opdrachtgever_id ? p.opdrachtgevers.get(v.opdrachtgever_id) : undefined;
    const wat = og ? opdrachtgeverLabel(og) : en ? STATUS_EN[c.status] : STATUS[c.status].label;
    regels.push(`${lab}: ${wat}${c.sub ? ` (${c.sub})` : ""}`);
  });
  if (p.ritten.length) {
    regels.push("", en ? "Scania trips:" : "Scania-ritten:");
    p.ritten.forEach((r) => regels.push(ritTekst(r, p.taal)));
  }
  regels.push("", en ? `Questions? Call us on ${TELEFOON.int}.` : `Vragen? Bel ons op ${TELEFOON.nl}.`, en ? "Kind regards, Solestus" : "Groet, Solestus");
  return regels.join("\n");
}
