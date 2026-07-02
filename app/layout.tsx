import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppRoot from "@/components/AppRoot";

export const metadata: Metadata = {
  title: "OpenChatbox",
  description: "Self-hosted KI-Chat (Ollama & OpenAI-kompatibel)",
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
    // Store is namespaced per user: key = 'openchatbox-store::' + uid.
    // Mirror nsKey() so light-mode users don't get a dark flash on load.
    var uid = localStorage.getItem('nexus-uid') || 'anon';
    var raw = localStorage.getItem('openchatbox-store::' + uid)
      || localStorage.getItem('chatbot-ui-store::' + uid)
      || localStorage.getItem('chatbot-ui-store')
      || '{}';
    var s = JSON.parse(raw);
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
