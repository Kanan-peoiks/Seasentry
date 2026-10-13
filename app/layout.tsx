import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { IncidentStoreProvider } from "@/lib/incident-store";
import { NO_FLASH_THEME_SCRIPT } from "@/lib/theme";
import { SessionProvider } from "@/lib/session";
import ClientPreferences from "@/components/ui/ClientPreferences";

const plex = localFont({
  src: [
    { path: "../public/fonts/IBMPlexSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/IBMPlexSans-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SeaSentry — Satellite & AI Oil Spill Intelligence",
  description:
    "SeaSentry detects potential oil spills on the Caspian Sea using satellite SAR imagery, analyzes them with AI, and supports human review, response, and cleanup.",
  keywords: [
    "oil spill detection",
    "Caspian Sea",
    "satellite AI",
    "Sentinel-1",
    "SAR",
    "maritime intelligence",
    "SeaSentry",
  ],
  openGraph: {
    title: "SeaSentry Dashboard",
    description:
      "Caspian Sea oil spill intelligence — satellite detection, AI analysis, and operator response.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plex.variable} suppressHydrationWarning>
      <head>
        {/* Applies the saved (or OS-preferred) theme before first paint,
            so there's no flash of the wrong theme on load. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body>
        <ClientPreferences />
        <SessionProvider>
          <IncidentStoreProvider>{children}</IncidentStoreProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
