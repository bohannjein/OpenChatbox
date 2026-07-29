import { cache } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppRoot from "@/components/AppRoot";
import { getBranding } from "@/lib/server/config";
import { brandTokenCss, normalizeHex } from "@/lib/branding";

/**
 * Branding is read from data/config.json at request time, so nothing may be
 * prerendered at build time — a statically baked layout would ship the default
 * brand forever. `cache` collapses the reads within a single request.
 */
export const dynamic = "force-dynamic";
const brand = cache(() => getBranding());

/**
 * Tab title, description and app icon come from the admin branding — a company
 * instance must not announce itself as the product default. Dynamic (not static
 * metadata) because branding lives in data/config.json, not in the build.
 */
export async function generateMetadata(): Promise<Metadata> {
  const b = brand();
  return {
    title: b.appName,
    description: b.tagline || "Self-hosted KI-Chat (Ollama & OpenAI-kompatibel)",
    icons: { icon: "/api/brand/icon", apple: "/api/brand/icon" },
    openGraph: { title: b.appName, description: b.tagline || undefined },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: normalizeHex(brand().accentColor),
    width: "device-width",
    initialScale: 1,
  };
}

// Set theme class before hydration to avoid flash of wrong theme.
const themeScript = `
(function(){
  try {
    // Store is namespaced per user: key = 'openchatbox-store::' + uid.
    // Mirror nsKey() so light-mode users don't get a dark flash on load.
    var uid = localStorage.getItem('nexus-uid') || 'anon';
    var raw = localStorage.getItem('openchatbox-store::' + uid)
      || localStorage.getItem('chatbot-ui-store::' + uid)
      || localStorage.getItem('chatbot-ui-store')
      || '{}';
    var s = JSON.parse(raw);
    var t = (s.state && s.state.theme) || 'dark';
    var d = document.documentElement;
    // Dracula rides on top of the dark class (+ its own override class).
    if (t === 'dark' || t === 'dracula') d.classList.add('dark');
    else d.classList.remove('dark');
    if (t === 'dracula') d.classList.add('dracula');
  } catch(e) { document.documentElement.classList.add('dark'); }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Accent from the server, so the very first paint is already the
            company color — including on /login, where the app shell (which
            applies it client-side) never mounts. */}
        <style dangerouslySetInnerHTML={{ __html: brandTokenCss(brand().accentColor) }} />
      </head>
      <body>
        <AppRoot />
        {children}
      </body>
    </html>
  );
}
