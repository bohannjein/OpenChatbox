import { NextRequest, NextResponse } from "next/server";
import { createUser, hasAdmin, publicUser } from "@/lib/server/users";
import { setConfig, publicConfig } from "@/lib/server/config";
import {
  makeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** First-run status: does this instance still need initial setup? */
export async function GET() {
  return NextResponse.json({ needsSetup: !hasAdmin() });
}

/** Create the first admin + persist basic server data. Runs exactly once. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? "");
  const appName = String(body.appName ?? "").trim() || "OpenChatbox";
  const providerType = body.providerType === "openai" ? "openai" : "ollama";
  const baseUrl = String(body.baseUrl ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();

  if (!username)
    return NextResponse.json(
      { error: "Benutzername erforderlich." },
      { status: 400 }
    );
  if (password.length < 8)
    return NextResponse.json(
      { error: "Passwort muss mindestens 8 Zeichen lang sein." },
      { status: 400 }
    );
  if (password !== confirm)
    return NextResponse.json(
      { error: "Passwörter stimmen nicht überein." },
      { status: 400 }
    );
  if (!baseUrl)
    return NextResponse.json(
      { error: "Server-Adresse (Base URL) erforderlich." },
      { status: 400 }
    );
  if (providerType === "openai" && !apiKey)
    return NextResponse.json(
      { error: "API-Key für OpenAI-kompatible Anbieter erforderlich." },
      { status: 400 }
    );

  try {
    // Hard guard, re-checked synchronously right before creation: setup is a
    // one-time bootstrap. Everything from here to save() is synchronous (no
    // await), so two concurrent POSTs cannot both create an admin — the second
    // sees hasAdmin() === true. Once an admin exists, never create another.
    if (hasAdmin())
      return NextResponse.json(
        { error: "Setup wurde bereits abgeschlossen." },
        { status: 409 }
      );
    const user = createUser(username, password, {
      role: "admin",
      provider: "local",
    });
    setConfig({
      appName,
      primaryProvider: {
        type: providerType,
        baseUrl,
        apiKey: apiKey || undefined,
      },
      setupCompletedAt: Date.now(),
    });

    const res = NextResponse.json({
      ok: true,
      user: publicUser(user),
      config: publicConfig(),
      // returned once to the admin who just entered it, so the client can seed
      // its provider list without a second round-trip.
      provider: { type: providerType, baseUrl, apiKey: apiKey || undefined },
    });
    res.cookies.set(SESSION_COOKIE, makeSession(user), sessionCookieOptions);
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler beim Setup." },
      { status: 400 }
    );
  }
}
