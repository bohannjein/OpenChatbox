"use client";

import { useEffect, useState } from "react";
import { Users, Trash2, Lock, Unlock, KeyRound, Loader2, UserPlus } from "lucide-react";
import clsx from "clsx";

type U = {
  id: string;
  username: string;
  role: string;
  provider: string;
  blocked: boolean;
  builtin: boolean;
};

const ROLES = ["user", "poweruser", "admin"];

/** Admin panel to manage all users: role, block/unblock, reset password, delete. */
export default function UserManagement() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nu, setNu] = useState({ username: "", password: "", role: "user" });

  const load = async () => {
    try {
      const r = await fetch("/api/admin/users");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      setUsers(d.users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

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
      setNu({ username: "", password: "", role: "user" });
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
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border-light p-2 dark:border-border-dark">
        <input
          value={nu.username}
          onChange={(e) => setNu({ ...nu, username: e.target.value })}
          placeholder="Benutzername"
          className="input-base min-w-0 flex-1 py-1"
        />
        <input
          type="password"
          value={nu.password}
          onChange={(e) => setNu({ ...nu, password: e.target.value })}
          placeholder="Passwort"
          className="input-base min-w-0 flex-1 py-1"
        />
        <select
          value={nu.role}
          onChange={(e) => setNu({ ...nu, role: e.target.value })}
          className="input-base w-28 py-1 text-xs"
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
          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
        >
          <UserPlus size={15} /> Anlegen
        </button>
      </div>

      {!users ? (
        <Loader2 size={16} className="animate-spin text-neutral-400" />
      ) : (
        <div className="space-y-1.5">
          {users.map((u) => (
            <div
              key={u.id}
              className={clsx(
                "flex items-center gap-2 rounded-xl border border-border-light p-2 dark:border-border-dark",
                u.blocked && "opacity-60"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {u.username}
                  {u.builtin && (
                    <span className="rounded bg-accent/15 px-1 text-[10px] text-accent">
                      built-in
                    </span>
                  )}
                  {u.blocked && <span className="text-[10px] text-red-500">gesperrt</span>}
                </div>
                <div className="text-xs text-neutral-400">{u.provider}</div>
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
          ))}
        </div>
      )}
    </div>
  );
}
