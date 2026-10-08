"use client";

import { useEffect } from "react";

/** Registers public/sw.js (installable app + offline page). Production only: in dev it would serve stale chunks. */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
