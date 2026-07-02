import { NextRequest } from "next/server";
import os from "os";
import { getAdmin } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin web-terminal backend. Security model:
 *  - Admin-only (verified server-side, not just via UI).
 *  - NO shell, NO child_process, NO arbitrary execution. `ollama <cmd>` is
 *    mapped to the Ollama HTTP API of the configured server; `status`/`help`
 *    are computed in-process. So there is zero RCE surface — the worst an
 *    admin can do is what the Ollama API already allows (pull/rm models).
 */

type Line = { t: "in" | "out" | "err" | "done"; v: string };

const enc = new TextEncoder();
const line = (l: Line) => enc.encode(JSON.stringify(l) + "\n");

function tokenize(input: string): string[] {
  // split on whitespace but keep "quoted args"
  return (input.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((t) =>
    t.replace(/^["']|["']$/g, "")
  );
}

const normUrl = (u: string) => u.replace(/\/+$/, "");
const fmtBytes = (n: number) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
};

async function oGet(baseUrl: string, path: string) {
  const r = await fetch(`${normUrl(baseUrl)}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
  return r.json();
}
async function oSend(baseUrl: string, path: string, method: string, body: unknown) {
  const r = await fetch(`${normUrl(baseUrl)}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}: ${await r.text().catch(() => "")}`);
  return r;
}

function serverStatus(): string {
  const mt = os.totalmem();
  const mf = os.freemem();
  return [
    `host:      ${os.hostname()}`,
    `platform:  ${os.platform()} ${os.release()} (${os.arch()})`,
    `cpus:      ${os.cpus().length}× ${os.cpus()[0]?.model?.trim() ?? "?"}`,
    `loadavg:   ${os.loadavg().map((n) => n.toFixed(2)).join("  ")}`,
    `memory:    ${fmtBytes(mt - mf)} / ${fmtBytes(mt)} used`,
    `os uptime: ${(os.uptime() / 3600).toFixed(1)} h`,
    `app uptime:${(process.uptime() / 3600).toFixed(2)} h`,
    `node:      ${process.version}`,
  ].join("\n");
}

const HELP = [
  "Verfügbare Befehle:",
  "  ollama list | ls          — installierte Modelle",
  "  ollama ps                 — laufende Modelle",
  "  ollama show <model>       — Modell-Details",
  "  ollama pull <model>       — Modell laden (Fortschritt)",
  "  ollama rm <model>         — Modell löschen",
  "  ollama cp <src> <dst>     — Modell kopieren",
  "  ollama version            — Ollama-Version",
  "  status                    — Server-Status (CPU/RAM/Uptime)",
  "  help                      — diese Hilfe",
  "  clear                     — Terminal leeren (lokal)",
].join("\n");

export async function POST(req: NextRequest) {
  if (!getAdmin(req))
    return new Response("Forbidden — Adminrechte erforderlich.", { status: 403 });

  let body: { command?: string; baseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const input = (body.command || "").trim();
  const baseUrl = (body.baseUrl || "").trim();
  const tokens = tokenize(input);

  const stream = new ReadableStream({
    async start(controller) {
      const out = (v: string) => controller.enqueue(line({ t: "out", v }));
      const err = (v: string) => controller.enqueue(line({ t: "err", v }));
      const done = () => {
        controller.enqueue(line({ t: "done", v: "" }));
        controller.close();
      };
      try {
        const head = (tokens[0] || "").toLowerCase();

        if (!head || head === "help") return out(HELP), done();
        if (head === "status") return out(serverStatus()), done();

        if (head !== "ollama") {
          err(`Unbekannter Befehl: "${head}". Tippe "help".`);
          return done();
        }

        const sub = (tokens[1] || "").toLowerCase();
        const args = tokens.slice(2);
        if (!baseUrl) {
          err("Kein Ollama-Server ausgewählt.");
          return done();
        }

        switch (sub) {
          case "list":
          case "ls": {
            const d = await oGet(baseUrl, "/api/tags");
            const rows = (d.models ?? []) as Array<{
              name: string;
              size: number;
              modified_at: string;
            }>;
            if (!rows.length) return out("(keine Modelle)"), done();
            out("NAME".padEnd(32) + "SIZE".padEnd(12) + "MODIFIED");
            for (const m of rows)
              out(
                m.name.padEnd(32) +
                  fmtBytes(m.size).padEnd(12) +
                  (m.modified_at?.slice(0, 10) ?? "")
              );
            return done();
          }
          case "ps": {
            const d = await oGet(baseUrl, "/api/ps");
            const rows = (d.models ?? []) as Array<{
              name: string;
              size: number;
              expires_at: string;
            }>;
            if (!rows.length) return out("(keine laufenden Modelle)"), done();
            out("NAME".padEnd(32) + "SIZE".padEnd(12) + "EXPIRES");
            for (const m of rows)
              out(
                m.name.padEnd(32) +
                  fmtBytes(m.size).padEnd(12) +
                  (m.expires_at?.slice(11, 19) ?? "")
              );
            return done();
          }
          case "version": {
            const d = await oGet(baseUrl, "/api/version");
            return out(`ollama version ${d.version ?? "?"}`), done();
          }
          case "show": {
            if (!args[0]) return err("Nutzung: ollama show <model>"), done();
            const d = await oSend(baseUrl, "/api/show", "POST", { model: args[0] });
            const j = await d.json();
            out(`model:      ${args[0]}`);
            if (j.details)
              out(
                `family:     ${j.details.family ?? "?"} · ${
                  j.details.parameter_size ?? "?"
                } · ${j.details.quantization_level ?? "?"}`
              );
            if (j.parameters) out("parameters:\n" + j.parameters);
            return done();
          }
          case "rm":
          case "delete": {
            if (!args[0]) return err("Nutzung: ollama rm <model>"), done();
            await oSend(baseUrl, "/api/delete", "DELETE", { model: args[0] });
            return out(`deleted '${args[0]}'`), done();
          }
          case "cp":
          case "copy": {
            if (!args[0] || !args[1])
              return err("Nutzung: ollama cp <src> <dst>"), done();
            await oSend(baseUrl, "/api/copy", "POST", {
              source: args[0],
              destination: args[1],
            });
            return out(`copied '${args[0]}' -> '${args[1]}'`), done();
          }
          case "pull": {
            if (!args[0]) return err("Nutzung: ollama pull <model>"), done();
            const r = await oSend(baseUrl, "/api/pull", "POST", {
              model: args[0],
              stream: true,
            });
            const reader = r.body!.getReader();
            const dec = new TextDecoder();
            let buf = "";
            let last = "";
            for (;;) {
              const { done: d, value } = await reader.read();
              if (d) break;
              buf += dec.decode(value, { stream: true });
              const parts = buf.split("\n");
              buf = parts.pop() ?? "";
              for (const p of parts) {
                if (!p.trim()) continue;
                try {
                  const j = JSON.parse(p);
                  let l = j.status ?? "";
                  if (j.total && j.completed)
                    l += `  ${Math.floor((j.completed / j.total) * 100)}%`;
                  if (l && l !== last) out(l), (last = l);
                } catch {
                  /* ignore partial */
                }
              }
            }
            return out(`✓ '${args[0]}' geladen`), done();
          }
          case "run":
            err("`ollama run` ist interaktiv — nutze den Chat. Für Details: ollama show <model>.");
            return done();
          default:
            err(`Unbekanntes ollama-Kommando: "${sub}". Tippe "help".`);
            return done();
        }
      } catch (e) {
        err(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
        done();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
