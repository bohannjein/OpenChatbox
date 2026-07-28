import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/server/adminAuth";
import { generateImage } from "@/lib/server/imagegen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate an image with the admin-configured backend (API key server-side). */
export async function POST(req: NextRequest) {
  if (!getUser(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { prompt } = await req.json().catch(() => ({}));
  if (typeof prompt !== "string" || !prompt.trim())
    return NextResponse.json({ error: "Kein Prompt." }, { status: 400 });
  const out = await generateImage(prompt);
  return NextResponse.json(out, { status: out.error ? 502 : 200 });
}
