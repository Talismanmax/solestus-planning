"use client";

import { useEffect } from "react";

/** Balk boven de afdrukpagina (niet op papier). Opent de printdialoog zodra de lettertypen geladen zijn. */
export default function AfdrukBalk({ titel }: { titel: string }) {
  useEffect(() => {
    let weg = false;
    document.fonts.ready.then(() => { if (!weg) setTimeout(() => window.print(), 300); });
    return () => { weg = true; };
  }, []);
  return (
    <div className="afdruk-balk">
      <span><b>{titel}</b> · kies bij het afdrukken “Opslaan als PDF” om een PDF te maken.</span>
      <button type="button" className="knop" onClick={() => window.close()}>Sluiten</button>
      <button type="button" className="knop knop-zwart" onClick={() => window.print()}>Afdrukken of opslaan als PDF</button>
    </div>
  );
}
