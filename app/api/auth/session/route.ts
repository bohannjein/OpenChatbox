import { NextRequest, NextResponse } from "next/server";
import { verify, SESSION_COOKIE } from "@/lib/server/session";
import { findById, publicUser } from "@/lib/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const payload = verify(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload || payload.purpose !== "session")
    return NextResponse.json({ user: null }, { status: 200 });
  const user = findById(payload.uid);
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({ user: publicUser(user) });
}
