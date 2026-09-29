/** Weergave: licht, donker of volgens het systeem. Per browser bewaard; zonder keuze volgt de app het systeem. */
export type Thema = "licht" | "donker" | "systeem";
export const THEMA_SLEUTEL = "solestus-thema";

/** Draait in <head> vóór het eerste tekenen, zodat er geen licht scherm flitst. */
export const THEMA_SCRIPT = `try{var t=localStorage.getItem("${THEMA_SLEUTEL}");if(t==="licht"||t==="donker")document.documentElement.setAttribute("data-thema",t)}catch(e){}`;

export function leesThema(): Thema {
  try {
    const t = localStorage.getItem(THEMA_SLEUTEL);
    return t === "licht" || t === "donker" ? t : "systeem";
  } catch { return "systeem"; }
}

export function zetThema(t: Thema) {
  if (t === "systeem") document.documentElement.removeAttribute("data-thema");
  else document.documentElement.setAttribute("data-thema", t);
  try { if (t === "systeem") localStorage.removeItem(THEMA_SLEUTEL); else localStorage.setItem(THEMA_SLEUTEL, t); } catch { /* geen opslag: alleen deze sessie */ }
}
