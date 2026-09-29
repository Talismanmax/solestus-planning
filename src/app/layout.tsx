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
      <body>{children}</body>
    </html>
  );
}
