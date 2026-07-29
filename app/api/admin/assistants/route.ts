import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/server/adminAuth";
import {
  createKey,
  deleteAssistant,
  listAssistants,
  publicAssistant,
  revokeKey,
  upsertAssistant,
} from "@/lib/server/assistants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const all = () => listAssistants().map(publicAssistant);

/** All embedded assistants (key hashes stripped). */
export async function GET(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ assistants: all() });
}

/**
 * Single mutating endpoint, action-discriminated (same shape as admin/users):
 * create | update | delete | createKey | revokeKey. Always answers with the
 * refreshed list so the panel never needs a second round-trip. A freshly minted
 * key's plaintext is returned exactly once, in `key`.
 */
export async function POST(req: NextRequest) {
  if (!getAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const id = typeof body.id === "string" ? body.id : "";

  try {
    switch (action) {
      case "create":
      case "update": {
        const a = upsertAssistant(action === "create" ? { ...body, id: undefined } : body);
        return NextResponse.json({ assistants: all(), assistant: publicAssistant(a) });
      }
      case "delete": {
        if (!deleteAssistant(id))
          return NextResponse.json({ error: "Assistent nicht gefunden." }, { status: 404 });
        return NextResponse.json({ assistants: all() });
      }
      case "createKey": {
        const kind = body.kind === "public" ? "public" : "secret";
        const made = createKey(id, kind, typeof body.label === "string" ? body.label : "");
        if (!made)
          return NextResponse.json({ error: "Assistent nicht gefunden." }, { status: 404 });
        // The only time the plaintext leaves the server.
        return NextResponse.json({ assistants: all(), key: made.key });
      }
      case "revokeKey": {
        const keyId = typeof body.keyId === "string" ? body.keyId : "";
        if (!revokeKey(id, keyId))
          return NextResponse.json({ error: "Schlüssel nicht gefunden." }, { status: 404 });
        return NextResponse.json({ assistants: all() });
      }
      default:
        return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler." },
      { status: 400 }
    );
  }
}
