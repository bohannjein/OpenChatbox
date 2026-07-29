import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import {
  listUsers,
  deleteUser,
  setUserRole,
  setUserBlocked,
  adminResetPassword,
  createUser,
  setUserKbCategories,
  setUserEmail,
  setUserProfile,
  clearTwoFactor,
  validateUsername,
  type ProfilePatch,
} from "@/lib/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ users: listUsers() });
}

/**
 * Admin user actions: create | updateProfile | delete | block | unblock |
 * setRole | resetPassword | setKbCategories | setEmail | clearTwoFactor.
 */
export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { action, userId, value } = body;

  // Create a new account (admin). No userId required.
  if (action === "create") {
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const role = ["admin", "poweruser", "user"].includes(body.role) ? body.role : "user";
    if (!username || password.length < 6)
      return NextResponse.json(
        { error: "Benutzername und Passwort (min. 6 Zeichen) nötig." },
        { status: 400 }
      );
    if (!firstName || !lastName)
      return NextResponse.json(
        { error: "Vor- und Nachname erforderlich." },
        { status: 400 }
      );
    const nameError = validateUsername(username);
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
    try {
      createUser(username, password, { role, firstName, lastName, email });
      return NextResponse.json({ ok: true, users: listUsers() });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Fehler" },
        { status: 400 }
      );
    }
  }

  if (!userId) return NextResponse.json({ error: "userId fehlt" }, { status: 400 });

  // Edit the account's attributes in one go (the admin form sends the whole set).
  // Unlike the single-field actions below, this reports WHY it failed — a taken
  // username or a malformed address needs a specific message, not "not possible".
  if (action === "updateProfile") {
    const p = (body.profile ?? {}) as Record<string, unknown>;
    const patch: ProfilePatch = {};
    for (const k of ["username", "firstName", "lastName", "displayName", "email"] as const)
      if (typeof p[k] === "string") patch[k] = p[k] as string;
    const error = setUserProfile(userId, patch);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true, users: listUsers() });
  }

  let ok = false;
  switch (action) {
    case "delete":
      ok = deleteUser(userId);
      break;
    case "block":
      ok = setUserBlocked(userId, true);
      break;
    case "unblock":
      ok = setUserBlocked(userId, false);
      break;
    case "setRole":
      ok = setUserRole(userId, String(value || "user"));
      break;
    case "resetPassword":
      ok = adminResetPassword(userId, String(value || ""));
      break;
    case "setKbCategories":
      ok = setUserKbCategories(
        userId,
        Array.isArray(body.kbCategories) ? body.kbCategories : []
      );
      break;
    case "setEmail":
      ok = setUserEmail(userId, String(value ?? ""));
      break;
    case "clearTwoFactor":
      // Recovery: the user lost their authenticator and can't sign in to turn
      // 2FA off themselves.
      ok = clearTwoFactor(userId);
      break;
    default:
      return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  }
  if (!ok)
    return NextResponse.json(
      { error: "Aktion nicht möglich (Built-in-Admin geschützt oder ungültig)." },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, users: listUsers() });
}
