"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Trash2, Lock, Unlock, KeyRound, Loader2, UserPlus, Search, Mail } from "lucide-react";
import clsx from "clsx";
import { providerLabel } from "@/lib/authProvider";

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

const ROLES = ["user", "poweruser", "admin"];

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

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Users size={16} className="text-accent" />
        <h3 className="font-medium">Benutzerverwaltung</h3>
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
