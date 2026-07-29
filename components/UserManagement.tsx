"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Trash2,
  Lock,
  Unlock,
  KeyRound,
  Loader2,
  UserPlus,
  Search,
  Mail,
  Activity,
} from "lucide-react";
import clsx from "clsx";
import { providerLabel } from "@/lib/authProvider";
import InfoTip from "./InfoTip";

type U = {
  id: string;
  username: string;
  role: string;
  provider: string;
  blocked: boolean;
  builtin: boolean;
  kbCategories: string[];
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
};

type Cat = { id: string; name: string };

/** One active device/browser, from lib/server/presence (memory only). */
type Session = {
  key: string;
  uid: string;
  name: string;
  role: string;
  kind: "user" | "guest" | "assistant";
  ip: string;
  ua: string;
  firstSeen: number;
  lastSeen: number;
  hits: number;
};

const ROLES = ["user", "poweruser", "admin"];

const KIND_LABEL: Record<Session["kind"], string> = {
  user: "Konto",
  guest: "Gast",
  assistant: "Assistent",
};

/** "vor 2 Min" — good enough for a presence table, no dependency needed. */
function since(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 15) return "jetzt";
  if (s < 60) return `vor ${s} s`;
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std`;
  return `vor ${Math.floor(s / 86400)} Tg`;
}

/** Shorten a user-agent to the part a human reads: browser + platform. */
function browserOf(ua: string): string {
  if (!ua) return "unbekannt";
  const name =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && /Version\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : /curl\//i.test(ua) ? "curl"
    : "anderer";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return os ? `${name} · ${os}` : name;
}

/** Admin panel to manage all users: role, block/unblock, reset password, delete. */
export default function UserManagement() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [nu, setNu] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    role: "user",
  });

  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const [activeWindow, setActiveWindow] = useState(120_000);

  // Presence is in-memory on the server and refreshed by the clients' own 20 s
  // live-sync, so polling every 15 s here is enough to look live.
  const loadPresence = useCallback(async () => {
    const d = await fetch("/api/admin/presence", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (!d) return;
    setSessions(d.sessions ?? []);
    setLastSeen(d.lastSeen ?? {});
    setActiveWindow(d.windowMs ?? 120_000);
    setNow(d.now ?? Date.now());
  }, []);

  useEffect(() => {
    loadPresence();
    const t = setInterval(loadPresence, 15_000);
    // Keep the relative times moving between polls.
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [loadPresence]);

  const load = async () => {
    try {
      const r = await fetch("/api/admin/users");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      setUsers(d.users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    // Admin sees ALL knowledge categories → the grantable permission set.
    fetch("/api/kb", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCats(d.categories ?? []))
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  // Toggle one KB category for a user (admins have implicit all-access → hidden).
  const toggleCat = async (u: U, catId: string) => {
    const next = u.kbCategories.includes(catId)
      ? u.kbCategories.filter((c) => c !== catId)
      : [...u.kbCategories, catId];
    setBusy(u.id + "kb");
    setErr(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setKbCategories", userId: u.id, kbCategories: next }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      setUsers(d.users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const act = async (userId: string, action: string, value?: string) => {
    setBusy(userId + action);
    setErr(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, value }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      setUsers(d.users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const createUser = async () => {
    if (!nu.firstName.trim() || !nu.lastName.trim()) {
      setErr("Vor- und Nachname erforderlich.");
      return;
    }
    if (!nu.username.trim() || nu.password.length < 6) {
      setErr("Benutzername und Passwort (min. 6 Zeichen) nötig.");
      return;
    }
    setBusy("create");
    setErr(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...nu }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      setUsers(d.users);
      setNu({ firstName: "", lastName: "", username: "", email: "", password: "", role: "user" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const resetPw = (u: U) => {
    const pw = window.prompt(`Neues Passwort für "${u.username}" (min. 6 Zeichen):`);
    if (pw && pw.length >= 6) act(u.id, "resetPassword", pw);
    else if (pw !== null) setErr("Passwort muss mindestens 6 Zeichen haben.");
  };
  const del = (u: U) => {
    if (window.confirm(`Benutzer "${u.username}" wirklich löschen?`)) act(u.id, "delete");
  };
  const editEmail = (u: U) => {
    const mail = window.prompt(
      `E-Mail für "${u.username}" (für Passwort-Reset; leer = entfernen):`,
      u.email ?? ""
    );
    if (mail !== null) act(u.id, "setEmail", mail.trim());
  };

  // Full name for display; falls back to username when no name is stored.
  const fullName = (u: U) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || "";

  // Case-insensitive search across name, username and email.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !users) return users ?? [];
    return users.filter((u) =>
      [fullName(u), u.username, u.email ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [users, query]);

  const online = (uid: string) => (lastSeen[uid] ?? 0) > now - activeWindow;

  return (
    <div>
      {/* ── Active sessions ─────────────────────────────────────────────── */}
      <div className="mb-2 flex items-center gap-2">
        <Activity size={16} className="text-accent" />
        <h4 className="font-medium">Aktive Sitzungen</h4>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
          {sessions.length}
        </span>
        <InfoTip text="Wer in den letzten zwei Minuten eine Anfrage gestellt hat. Diese Angaben liegen ausschließlich im Arbeitsspeicher dieses Servers, werden nicht in data/ geschrieben und sind nach einem Neustart weg. Eine Zeile je Gerät bzw. Browser." />
      </div>
      {sessions.length === 0 ? (
        <p className="mb-4 text-sm text-neutral-400">
          Gerade niemand aktiv. Angemeldete Clients melden sich alle 20 Sekunden.
        </p>
      ) : (
        <div className="mb-4 max-h-52 space-y-1 overflow-y-auto pr-1">
          {sessions.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-2 rounded-lg border border-border-light px-2.5 py-1.5 text-xs dark:border-border-dark"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="min-w-0 truncate font-medium">{s.name}</span>
              <span className="shrink-0 rounded bg-neutral-200 px-1 text-[10px] text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                {KIND_LABEL[s.kind]}
              </span>
              <span className="min-w-0 truncate text-neutral-400">{browserOf(s.ua)}</span>
              <span className="ml-auto shrink-0 font-mono text-neutral-400">{s.ip}</span>
              <span className="shrink-0 text-neutral-500">{since(s.lastSeen, now)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-2 flex items-center gap-2 border-t border-border-light pt-4 dark:border-border-dark">
        <Users size={16} className="text-accent" />
        <h4 className="font-medium">Benutzer</h4>
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        Rollen vergeben, Konten sperren, Passwörter zurücksetzen oder löschen.
      </p>
      {err && <div className="mb-2 text-sm text-red-500">⚠ {err}</div>}

      {/* Create account */}
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-border-light p-2 dark:border-border-dark">
        <input
          value={nu.firstName}
          onChange={(e) => setNu({ ...nu, firstName: e.target.value })}
          placeholder="Vorname"
          className="input-base min-w-0 py-1"
        />
        <input
          value={nu.lastName}
          onChange={(e) => setNu({ ...nu, lastName: e.target.value })}
          placeholder="Nachname"
          className="input-base min-w-0 py-1"
        />
        <input
          value={nu.username}
          onChange={(e) => setNu({ ...nu, username: e.target.value })}
          placeholder="Benutzername"
          className="input-base min-w-0 py-1"
        />
        <input
          type="email"
          value={nu.email}
          onChange={(e) => setNu({ ...nu, email: e.target.value })}
          placeholder="E-Mail (optional, für Passwort-Reset)"
          className="input-base min-w-0 py-1"
        />
        <input
          type="password"
          value={nu.password}
          onChange={(e) => setNu({ ...nu, password: e.target.value })}
          placeholder="Passwort"
          className="input-base min-w-0 py-1"
        />
        <select
          value={nu.role}
          onChange={(e) => setNu({ ...nu, role: e.target.value })}
          className="input-base py-1 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          onClick={createUser}
          disabled={busy !== null}
          className="col-span-2 flex items-center justify-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
        >
          <UserPlus size={15} /> Anlegen
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nach Name, Benutzername oder E-Mail suchen…"
          className="input-base w-full py-1.5 pl-8"
        />
      </div>

      {!users ? (
        <Loader2 size={16} className="animate-spin text-neutral-400" />
      ) : filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-400">
          Keine Benutzer gefunden.
        </p>
      ) : (
        <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-border-light dark:border-border-dark"
            >
              <div
                className={clsx(
                  "flex items-center gap-2 p-2",
                  u.blocked && "opacity-60"
                )}
              >
              <span
                title={
                  online(u.id)
                    ? "gerade aktiv"
                    : lastSeen[u.id]
                    ? `zuletzt ${since(lastSeen[u.id], now)}`
                    : "seit dem letzten Neustart nicht gesehen"
                }
                className={clsx(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  online(u.id) ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {fullName(u) || u.username}
                  {u.builtin && (
                    <span className="rounded bg-accent/15 px-1 text-[10px] text-accent">
                      built-in
                    </span>
                  )}
                  {u.blocked && <span className="text-[10px] text-red-500">gesperrt</span>}
                </div>
                <div className="truncate text-xs text-neutral-400">
                  {fullName(u) ? `${u.username} · ` : ""}
                  {providerLabel(u.provider)}
                  {u.email ? ` · ${u.email}` : ""}
                  {lastSeen[u.id] && !online(u.id)
                    ? ` · zuletzt ${since(lastSeen[u.id], now)}`
                    : ""}
                </div>
              </div>

              <select
                value={u.role}
                disabled={u.builtin || busy !== null}
                onChange={(e) => act(u.id, "setRole", e.target.value)}
                className="input-base w-28 py-1 text-xs disabled:opacity-50"
                title="Rolle"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <button
                onClick={() => editEmail(u)}
                disabled={busy !== null}
                title={u.email ? `E-Mail: ${u.email}` : "E-Mail hinterlegen (für Passwort-Reset)"}
                className={clsx(
                  "rounded-lg p-1.5 transition hover:bg-neutral-200 dark:hover:bg-white/10",
                  u.email ? "text-accent" : "text-neutral-500 hover:text-accent"
                )}
              >
                <Mail size={15} />
              </button>

              <button
                onClick={() => resetPw(u)}
                disabled={busy !== null}
                title="Passwort zurücksetzen"
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200 hover:text-accent dark:hover:bg-white/10"
              >
                <KeyRound size={15} />
              </button>

              {!u.builtin && (
                <>
                  <button
                    onClick={() => act(u.id, u.blocked ? "unblock" : "block")}
                    disabled={busy !== null}
                    title={u.blocked ? "Entsperren" : "Sperren"}
                    className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200 dark:hover:bg-white/10"
                  >
                    {u.blocked ? <Unlock size={15} /> : <Lock size={15} />}
                  </button>
                  <button
                    onClick={() => del(u)}
                    disabled={busy !== null}
                    title="Löschen"
                    className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200 hover:text-red-500 dark:hover:bg-white/10"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              </div>

              {cats.length > 0 && (
                <div className="border-t border-border-light px-2 py-1.5 dark:border-border-dark">
                  {u.role === "admin" ? (
                    <span className="text-xs text-neutral-400">
                      Wissenszugriff: alle Kategorien (Admin)
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs font-medium text-neutral-500">
                        Wissenszugriff:
                      </span>
                      {cats.map((c) => (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-1 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={u.kbCategories.includes(c.id)}
                            disabled={busy !== null}
                            onChange={() => toggleCat(u, c.id)}
                            className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
