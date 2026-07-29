import { NextRequest } from "next/server";
import { authenticateAssistant, isFailure } from "@/lib/server/apiAuth";
import { corsHeaders, preflight } from "@/lib/server/apiCors";
import { getBranding } from "@/lib/server/config";
import { brandLogo } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/**
 * Public metadata the embed widget needs to render itself before the first turn:
 * the assistant's name and greeting plus the instance's brand colours. Requires a
 * valid key (and, for a widget key, an allowed origin) — so it doubles as the
 * widget's "is my key still good?" check.
 *
 * Deliberately narrow: no system prompt, no model name, no limits, nothing about
 * which knowledge is wired up. Those are the admin's business, and the response
 * is readable by anyone who can view the page source.
 */
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin") ?? "");
  const caller = authenticateAssistant(req);
  if (isFailure(caller))
    return Response.json({ error: { message: caller.error } }, { status: caller.status, headers: cors });

  const b = getBranding();
  return Response.json(
    {
      name: caller.assistant.name,
      greeting: caller.assistant.greeting,
      showSources: caller.assistant.showSources,
      brand: {
        appName: b.appName,
        accentColor: b.accentColor,
        logoUrl: brandLogo(b, false),
      },
    },
    { headers: { ...cors, "Cache-Control": "no-store" } }
  );
}
