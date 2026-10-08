"use client";

import { useEffect, useState } from "react";
import { Shield, Plus, Trash2, Loader2, Save } from "lucide-react";
import clsx from "clsx";
import { PERMISSIONS, type Role } from "@/lib/permissions";
import { useT, type StringKey } from "@/lib/i18n";

/** Admin UI to create/edit custom roles and toggle per-permission checkboxes. */
export default function RolesEditor() {
  const t = useT();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/roles");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("common.error"));
      setRoles(d.roles);
      if (!selId && d.roles[0]) select(d.roles[0]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (r: Role) => {
    setSelId(r.id);
    setName(r.name);
    setPerms(new Set(r.permissions));
  };
  const newRole = () => {
    setSelId(null);
    setName("");
    setPerms(new Set());
  };
  const toggle = (key: string) =>
    setPerms((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selId ?? undefined, name, permissions: [...perms] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("common.error"));
      await load();
      setSelId(d.role.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const del = async (r: Role) => {
    if (r.builtin) return;
    await fetch(`/api/admin/roles?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
    if (selId === r.id) newRole();
    load();
  };

  const selected = roles.find((r) => r.id === selId);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Shield size={16} className="text-accent" />
        <h3 className="font-medium">{t("roles.title")}</h3>
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        {t("roles.intro")}
      </p>

      {err && <div className="mb-2 text-sm text-red-500">⚠ {err}</div>}

      <div className="grid grid-cols-[10rem_1fr] gap-4">
        {/* Role list */}
        <div className="space-y-1">
          {loading && <Loader2 size={15} className="animate-spin text-neutral-400" />}
          {roles.map((r) => (
            <div key={r.id} className="group flex items-center gap-1">
              <button
                onClick={() => select(r)}
                className={clsx(
                  "min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm transition",
                  selId === r.id
                    ? "bg-accent/15 text-accent"
                    : "hover:bg-neutral-200/70 dark:hover:bg-white/10"
                )}
              >
                {r.name}
                {r.builtin && (
                  <span className="ml-1 text-[10px] text-neutral-400">built-in</span>
                )}
              </button>
              {!r.builtin && (
                <button
                  onClick={() => del(r)}
                  className="shrink-0 rounded p-1 text-neutral-400 opacity-0 transition hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                  title={t("roles.delete")}
                  aria-label={t("roles.delete")}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={newRole}
            className="mt-1 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border-light px-2 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            <Plus size={14} /> {t("roles.new")}
          </button>
        </div>

        {/* Editor */}
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("roles.namePh")}
            className="mb-3 w-full input-base"
          />
          <div className="space-y-1.5">
            {PERMISSIONS.map((p) => (
              <label
                key={p.key}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 hover:bg-neutral-100 dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={perms.has(p.key)}
                  onChange={() => toggle(p.key)}
                  className="mt-0.5 accent-[rgb(var(--accent))]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t(`roles.perm.${p.key}` as StringKey)}</span>
                  <span className="block text-xs text-neutral-500">{t(`roles.perm.${p.key}.desc` as StringKey)}</span>
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {selected ? t("roles.save") : t("roles.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
