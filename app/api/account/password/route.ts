import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/server/session";
import {
  findById,
  updateUser,
  verifyPassword,
  hashPassword,
} from "@/lib/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const p = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!p || p.purpose !== "session")
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const user = findById(p.uid);
  if (!user)
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const { current, next } = await req.json().catch(() => ({}));
  if (user.passHash && !verifyPassword(String(current || ""), user))
    return NextResponse.json(
      { error: "Aktuelles Passwort falsch" },
      { status: 401 }
    );
  if (!next || String(next).length < 6)
    return NextResponse.json(
      { error: "Neues Passwort min. 6 Zeichen" },
      { status: 400 }
    );
  const { salt, passHash } = hashPassword(String(next));
  updateUser(user.id, { salt, passHash });
  return NextResponse.json({ ok: true });
}
