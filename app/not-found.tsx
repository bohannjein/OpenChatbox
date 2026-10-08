"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Unknown URLs land on a fresh chat instead of a dead-end 404 page — the app
// shell (AppRoot) is already on screen, so the redirect is seamless.
export default function NotFound() {
  const router = useRouter();
  useEffect(() => router.replace("/"), [router]);
  return null;
}
