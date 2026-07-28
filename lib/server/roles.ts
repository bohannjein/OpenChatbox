import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";
import { ALL_PERMISSIONS, type Role } from "@/lib/permissions";

const FILE = path.join(DATA_DIR, "roles.json");

/** Built-in roles, seeded on first read. IDs match User.role values. */
function seed(): Role[] {
  return [
    { id: "admin", name: "Administrator", permissions: [...ALL_PERMISSIONS], builtin: true },
    {
      id: "poweruser",
      name: "Power-User",
      permissions: ["models.pull", "workspaces.create", "files.share", "chats.share"],
      builtin: true,
    },
    { id: "user", name: "Benutzer", permissions: ["chats.share"], builtin: true },
  ];
}

export function listRoles(): Role[] {
  try {
    const arr = JSON.parse(fs.readFileSync(FILE, "utf8")).roles as Role[];
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {
    /* fall through to seed */
  }
  const seeded = seed();
  save(seeded);
  return seeded;
}

function save(roles: Role[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ roles }, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

/** Create or update a role. Built-in flag/id are preserved. */
export function upsertRole(input: {
  id?: string;
  name: string;
  permissions: string[];
}): Role {
  const roles = listRoles();
  const perms = input.permissions.filter((p) => ALL_PERMISSIONS.includes(p));
  const existing = input.id ? roles.find((r) => r.id === input.id) : undefined;
  if (existing) {
    existing.name = input.name.trim() || existing.name;
    existing.permissions = perms;
    save(roles);
    return existing;
  }
  const role: Role = {
    id: crypto.randomUUID(),
    name: input.name.trim() || "Neue Rolle",
    permissions: perms,
  };
  roles.push(role);
  save(roles);
  return role;
}

export function deleteRole(id: string): boolean {
  const roles = listRoles();
  const target = roles.find((r) => r.id === id);
  if (!target || target.builtin) return false; // never delete built-ins
  save(roles.filter((r) => r.id !== id));
  return true;
}
