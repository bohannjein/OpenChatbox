import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import {
  listUsers,
  deleteUser,
  setUserRole,
  setUserBlocked,
  adminResetPassword,
  createUser,
} from "@/lib/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ users: listUsers() });
}

/** Admin user actions: delete | block | unblock | setRole | resetPassword. */
export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { action, userId, value } = body;

  // Create a new account (admin). No userId required.
  if (action === "create") {
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const role = ["admin", "poweruser", "user"].includes(body.role) ? body.role : "user";
    if (!username || password.length < 6)
      return NextResponse.json(
        { error: "Benutzername und Passwort (min. 6 Zeichen) nötig." },
        { status: 400 }
      );
    try {
      createUser(username, password, { role });
      return NextResponse.json({ ok: true, users: listUsers() });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Fehler" },
        { status: 400 }
      );
    }
  }

  if (!userId) return NextResponse.json({ error: "userId fehlt" }, { status: 400 });

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
