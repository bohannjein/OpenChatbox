"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Check, XCircle, Layers } from "lucide-react";
import { useStore } from "@/lib/store";

type State =
  | { k: "loading" }
  | { k: "ok"; name: string }
  | { k: "err"; msg: string };

export default function JoinWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const upsertWorkspace = useStore((s) => s.upsertWorkspace);
  const switchWorkspace = useStore((s) => s.switchWorkspace);
  const [state, setState] = useState<State>({ k: "loading" });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against double-invoke (StrictMode)
    ran.current = true;
    document.documentElement.classList.add("dark");
    if (!token) {
      setState({ k: "err", msg: "Kein Einladungs-Token." });
      return;
    }
    fetch("/api/workspaces/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Beitritt fehlgeschlagen.");
        return d;
      })
      .then((d) => {
        upsertWorkspace(d.workspace);
        switchWorkspace(d.workspace.id);
        setState({ k: "ok", name: d.workspace.name });
        setTimeout(() => router.push("/"), 1200);
      })
      .catch((e) => setState({ k: "err", msg: e.message }));
  }, [token, router, upsertWorkspace, switchWorkspace]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-main-dark px-4 text-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-border-dark bg-sidebar-dark p-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
          <Layers size={26} />
        </div>
        {state.k === "loading" && (
          <>
            <Loader2 size={20} className="mx-auto animate-spin text-accent" />
            <p className="mt-3 text-sm text-neutral-400">Trete Workspace bei…</p>
          </>
        )}
        {state.k === "ok" && (
          <>
            <Check size={22} className="mx-auto text-emerald-400" />
            <h1 className="mt-2 text-lg font-bold">Beigetreten</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Du bist jetzt Mitglied von „{state.name}". Weiterleitung…
            </p>
          </>
        )}
        {state.k === "err" && (
          <>
            <XCircle size={22} className="mx-auto text-red-400" />
            <h1 className="mt-2 text-lg font-bold">Fehlgeschlagen</h1>
            <p className="mt-1 text-sm text-neutral-400">{state.msg}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Zur App
            </button>
          </>
        )}
      </div>
    </div>
  );
}
