/** Lijniconen zoals in het design (stroke 2, afgeronde hoeken). */
const PADEN = {
  links: <path d="M15 6l-6 6 6 6" />,
  rechts: <path d="M9 6l6 6-6 6" />,
  omlaag: <path d="M6 9l6 6 6-6" />,
  omhoog: <path d="M6 15l6-6 6 6" />,
  sluiten: <path d="M6 6l12 12M18 6L6 18" />,
  zoek: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  vraag: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" /></>,
  wissel: <><path d="M17 3l4 4-4 4" /><path d="M3 11V9a2 2 0 0 1 2-2h16" /><path d="M7 21l-4-4 4-4" /><path d="M21 13v2a2 2 0 0 1-2 2H3" /></>,
  kopie: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  slot: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  waarschuwing: <><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18h.01" /></>,
  fout: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5h.01" /></>,
  vink: <path d="M5 12l5 5 9-10" />,
  geschiedenis: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  sync: <><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 21v-5h-5" /></>,
  uitloggen: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  tabel: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M4 15h16M10 4v16" /></>,
};

type IcoonNaam = keyof typeof PADEN;

export default function Icoon({ naam, maat = 18, dik = 2 }: { naam: IcoonNaam; maat?: number; dik?: number }) {
  return (
    <svg width={maat} height={maat} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={dik} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PADEN[naam]}
    </svg>
  );
}
