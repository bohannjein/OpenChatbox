import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";

/**
 * Server-side workspace registry — the source of truth for cross-user
 * collaboration (who may see a workspace). The client store mirrors the
 * caller's workspaces per session; membership lives here so a workspace can be
 * shared across accounts. Prepared to be swapped for a real DB.
 */
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  /** user ids with access (owner is always included) */
  members: string[];
  /** UUID invite token → /join-workspace/[token] */
  inviteToken: string;
  createdAt: number;
}

const FILE = path.join(DATA_DIR, "workspaces.json");

function load(): Workspace[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")).workspaces as Workspace[];
  } catch {
    return [];
  }
}
function save(workspaces: Workspace[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ workspaces }, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

export function listForUser(userId: string): Workspace[] {
  return load().filter((w) => w.members.includes(userId));
}

export function createWorkspace(name: string, ownerId: string): Workspace {
  const all = load();
  const ws: Workspace = {
    id: crypto.randomUUID(),
    name: name.trim() || "Workspace",
    ownerId,
    members: [ownerId],
    inviteToken: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  all.push(ws);
  save(all);
  return ws;
}

/** Look up a workspace by its invite token. */
export function findByInvite(token: string): Workspace | null {
  if (!token) return null;
  return load().find((w) => w.inviteToken === token) ?? null;
}

/**
 * Add a user to the workspace behind an invite token. Returns the workspace
 * (already-a-member is a no-op success), or null if the token is invalid.
 */
export function joinByInvite(token: string, userId: string): Workspace | null {
  const all = load();
  const i = all.findIndex((w) => w.inviteToken === token);
  if (i < 0) return null;
  if (!all[i].members.includes(userId)) {
    all[i].members.push(userId);
    save(all);
  }
  return all[i];
}

/** Rotate the invite token (owner only) to revoke old links. */
export function rotateInvite(id: string, ownerId: string): Workspace | null {
  const all = load();
  const i = all.findIndex((w) => w.id === id && w.ownerId === ownerId);
  if (i < 0) return null;
  all[i].inviteToken = crypto.randomUUID();
  save(all);
  return all[i];
}

export function setMembers(id: string, ownerId: string, members: string[]) {
  const all = load();
  const i = all.findIndex((w) => w.id === id && w.ownerId === ownerId);
  if (i < 0) return null;
  all[i].members = Array.from(new Set([ownerId, ...members]));
  save(all);
  return all[i];
}

export function deleteWorkspace(id: string, ownerId: string): boolean {
  const all = load();
  const next = all.filter((w) => !(w.id === id && w.ownerId === ownerId));
  if (next.length === all.length) return false;
  save(next);
  return true;
}
