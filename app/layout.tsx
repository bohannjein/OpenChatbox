import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppRoot from "@/components/AppRoot";

export const metadata: Metadata = {
  title: "Chatbot UI",
  description: "Self-hosted Chat-Oberfläche (Ollama & OpenAI-kompatibel)",
};

export const viewport: Viewport = {
  themeColor: "#212121",
  width: "device-width",
  initialScale: 1,
};

// Set theme class before hydration to avoid flash of wrong theme.
const themeScript = `
(function(){
  try {
    var s = JSON.parse(localStorage.getItem('chatbot-ui-store') || '{}');
    var t = (s.state && s.state.theme) || 'dark';
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
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
      </head>
      <body>
        <AppRoot />
        {children}
      </body>
    </html>
  );
}
