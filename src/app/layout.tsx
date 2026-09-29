import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solestus Planning",
  description: "Weekplanning van Solestus",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fustat:wght@400;600;700&family=Zilla+Slab:ital,wght@1,300&display=swap" />
        <link rel="preload" href="/fonts/PPNeueMachina-Ultrabold.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
