/** Laatste activiteit van de gebruiker, gedeeld tussen tabbladen (voor "sessie verlopen" na lang niets doen). */
const SLEUTEL = "solestus-laatst-actief";

export function laatstActief() {
  try { return Number(localStorage.getItem(SLEUTEL)) || Date.now(); } catch { return Date.now(); }
}

export function markeerActief() {
  try { localStorage.setItem(SLEUTEL, String(Date.now())); } catch { /* geen opslag: alleen de Supabase-controle */ }
}
