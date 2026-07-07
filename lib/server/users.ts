import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";

export interface User {
  id: string;
  username: string;
  /** scrypt hash (hex), empty for SSO-only accounts */
  passHash: string;
  salt: string;
  role: "admin" | "poweruser" | "user";
  /** identity provider: "local" | "entra" | "ad" */
  provider: string;
  /** email + display name (populated for SSO accounts from the ID token) */
  email?: string;
  displayName?: string;
  twoFactor: { enabled: boolean; secret?: string; pending?: string };
  /** admin-blocked accounts can't log in */
  blocked?: boolean;
  createdAt: number;
}

/** The permanent built-in admin (always present, cannot be deleted/blocked). */
export const BUILTIN_ADMIN = "administrator";
/** Default password for a freshly-seeded built-in admin. CHANGE IT after first
 *  login — it's a well-known default, only meant to bootstrap a new deployment. */
export const DEFAULT_ADMIN_PASSWORD =
  process.env.ADMIN_DEFAULT_PASSWORD || "openchatbox";
export const isBuiltinAdmin = (u: { username: string }) =>
  u.username.toLowerCase() === BUILTIN_ADMIN;

// Data dir survives restarts; prepared to be swapped for a real DB.
const FILE = path.join(DATA_DIR, "users.json");

function load(): User[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")).users as User[];
  } catch {
    return [];
  }
}
function save(users: User[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Atomic write: a crash mid-write must not leave a truncated users.json
  // (which would otherwise read as "no users" and re-open the setup gate).
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

const uid = () => crypto.randomUUID();

export function hashPassword(password: string, salt?: string) {
  const s = salt ?? crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, s, 64).toString("hex");
  return { salt: s, passHash: hash };
}
export function verifyPassword(password: string, u: User): boolean {
  if (!u.passHash) return false;
  const { passHash } = hashPassword(password, u.salt);
  const a = Buffer.from(passHash, "hex");
  const b = Buffer.from(u.passHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Ensure the permanent built-in admin exists (administrator / openchatbox by
 * default, or ADMIN_DEFAULT_PASSWORD). Idempotent — only seeds when the account
 * is missing, so an existing (possibly password-changed) admin is untouched;
 * never clobbers a corrupt file (only seeds when readable).
 */
export function ensureSeed() {
  let users: User[];
  try {
    if (!fs.existsSync(FILE)) users = [];
    else users = (JSON.parse(fs.readFileSync(FILE, "utf8")).users as User[]) ?? [];
  } catch {
    return; // unreadable/corrupt → don't overwrite
  }
  if (!users.some(isBuiltinAdmin)) {
    const { salt, passHash } = hashPassword(DEFAULT_ADMIN_PASSWORD);
    users.push({
      id: uid(),
      username: BUILTIN_ADMIN,
      passHash,
      salt,
      role: "admin",
      provider: "local",
      twoFactor: { enabled: false },
      createdAt: Date.now(),
    });
    save(users);
  }
}

/** An admin always exists now (built-in) → the first-run setup screen is off. */
export function hasAdmin(): boolean {
  ensureSeed();
  return load().some((u) => u.role === "admin");
}

export function findByUsername(username: string): User | undefined {
  ensureSeed();
  return load().find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );
}
export function findById(id: string): User | undefined {
  return load().find((u) => u.id === id);
}

export function createUser(
  username: string,
  password: string,
  opts: { role?: User["role"]; provider?: string } = {}
): User {
  const users = load();
  if (
    users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())
  )
    throw new Error("Benutzername bereits vergeben.");
  const { salt, passHash } = password
    ? hashPassword(password)
    : { salt: "", passHash: "" };
  const user: User = {
    id: uid(),
    username: username.trim(),
    passHash,
    salt,
    role: opts.role ?? "user",
    provider: opts.provider ?? "local",
    twoFactor: { enabled: false },
    createdAt: Date.now(),
  };
  users.push(user);
  save(users);
  return user;
}

export function updateUser(id: string, patch: Partial<User>) {
  const users = load();
  const i = users.findIndex((u) => u.id === id);
  if (i < 0) return;
  users[i] = { ...users[i], ...patch };
  save(users);
}

export interface SsoProfile {
  username: string;
  email?: string;
  displayName?: string;
  role?: User["role"];
}

/**
 * Find a linked SSO user or create one on first login, and sync the profile
 * (email, display name, role) from the identity provider each time — the IdP is
 * the source of truth for SSO accounts. The built-in admin is never touched.
 */
export function upsertSsoUser(profile: SsoProfile, provider: string): User {
  const existing = findByUsername(profile.username);
  if (existing) {
    const patch: Partial<User> = {};
    if (profile.email && profile.email !== existing.email) patch.email = profile.email;
    if (profile.displayName && profile.displayName !== existing.displayName)
      patch.displayName = profile.displayName;
    // Sync role from the IdP, but never demote the permanent built-in admin.
    if (profile.role && profile.role !== existing.role && !isBuiltinAdmin(existing))
      patch.role = profile.role;
    if (Object.keys(patch).length) {
      updateUser(existing.id, patch);
      return { ...existing, ...patch };
    }
    return existing;
  }
  const user = createUser(profile.username, "", { provider, role: profile.role });
  if (profile.email || profile.displayName)
    updateUser(user.id, { email: profile.email, displayName: profile.displayName });
  return { ...user, email: profile.email, displayName: profile.displayName };
}

/** Public view (no secrets). */
export function publicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    provider: u.provider,
    twoFactorEnabled: u.twoFactor.enabled,
    blocked: !!u.blocked,
    builtin: isBuiltinAdmin(u),
  };
}

/** All users (admin view). */
export function listUsers() {
  ensureSeed();
  return load().map(publicUser);
}

/** Delete a user (never the built-in admin). */
export function deleteUser(id: string): boolean {
  const users = load();
  const target = users.find((u) => u.id === id);
  if (!target || isBuiltinAdmin(target)) return false;
  save(users.filter((u) => u.id !== id));
  return true;
}

/** Set a user's role (never demote the built-in admin). */
export function setUserRole(id: string, role: string): boolean {
  const users = load();
  const u = users.find((x) => x.id === id);
  if (!u || isBuiltinAdmin(u)) return false;
  updateUser(id, { role: role as User["role"] });
  return true;
}

/** Block / unblock a user (never the built-in admin). */
export function setUserBlocked(id: string, blocked: boolean): boolean {
  const users = load();
  const u = users.find((x) => x.id === id);
  if (!u || isBuiltinAdmin(u)) return false;
  updateUser(id, { blocked });
  return true;
}

/** Admin reset of a user's password. */
export function adminResetPassword(id: string, newPassword: string): boolean {
  const users = load();
  const u = users.find((x) => x.id === id);
  if (!u || !newPassword || newPassword.length < 6) return false;
  updateUser(id, hashPassword(newPassword));
  return true;
}
