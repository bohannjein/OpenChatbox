"use client";

import "./globals.css";

// Last-resort screen when the app shell itself crashes. It replaces the root
// layout, so it cannot rely on the store (theme, language) — it reads the
// browser language and offers the one useful action: reload.
const COPY = {
  de: {
    title: "Etwas ist schiefgelaufen",
    body: "Die App ist auf einen unerwarteten Fehler gestoßen. Deine Chats sind gespeichert. Lade die Seite neu, um weiterzumachen.",
    reload: "Neu laden",
  },
  en: {
    title: "Something went wrong",
    body: "The app hit an unexpected error. Your chats are saved. Reload the page to continue.",
    reload: "Reload",
  },
};

export default function GlobalError() {
  let lang: "de" | "en" = "de";
  try {
    if (navigator.language.toLowerCase().startsWith("en")) lang = "en";
  } catch {
    /* server render → de */
  }
  const c = COPY[lang];
  return (
    <html lang={lang}>
      <body className="flex h-dvh items-center justify-center bg-main-light p-6 text-neutral-900">
        <main className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">{c.title}</h1>
          <p className="mt-2 text-sm text-neutral-600">{c.body}</p>
          <button
            onClick={() => location.reload()}
            className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {c.reload}
          </button>
        </main>
      </body>
    </html>
  );
}
