/** Voornaam van een gebruiker, anders het deel van het e-mailadres vóór de @. */
export function korteNaam(g: { naam?: string | null; email?: string | null } | null | undefined, anders = "onbekend") {
  return g?.naam?.trim().split(/\s+/)[0] || g?.email?.split("@")[0] || anders;
}

/** "MA" voor Max, "MZ" voor Max Zomer. */
export function initialen(naam: string) {
  const w = naam.trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : naam.slice(0, 2)).toUpperCase();
}
