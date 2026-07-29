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
  /** given/family name — admin-entered for locally-created accounts */
  firstName?: string;
  lastName?: string;
  /** knowledge-base category ids this user may access (ACL). Admins see all
   *  categories implicitly regardless of this list. */
  kbCategories?: string[];
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

/** Find by username OR email (case-insensitive) — for password-reset requests. */
export function findByUsernameOrEmail(identifier: string): User | undefined {
  ensureSeed();
  const id = identifier.trim().toLowerCase();
  if (!id) return undefined;
  return load().find(
    (u) =>
      u.username.toLowerCase() === id ||
      (!!u.email && u.email.toLowerCase() === id)
  );
}

export function createUser(
  username: string,
  password: string,
  opts: {
    role?: User["role"];
    provider?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email?: string;
  } = {}
): User {
  const users = load();
  if (
    users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())
  )
    throw new Error("Benutzername bereits vergeben.");
  const { salt, passHash } = password
    ? hashPassword(password)
    : { salt: "", passHash: "" };
  const firstName = opts.firstName?.trim() || undefined;
  const lastName = opts.lastName?.trim() || undefined;
  // displayName falls back to "Vorname Nachname" when not given explicitly.
  const displayName =
    opts.displayName?.trim() ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    undefined;
  const user: User = {
    id: uid(),
    username: username.trim(),
    passHash,
    salt,
    role: opts.role ?? "user",
    provider: opts.provider ?? "local",
    firstName,
    lastName,
    displayName,
    email: opts.email?.trim() || undefined,
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
  firstName?: string;
  lastName?: string;
  role?: User["role"];
}

/**
 * Find a linked SSO user or create one on first login, and sync the profile
 * (name, email, role) from the identity provider each time — the IdP is the
 * source of truth for SSO accounts. The built-in admin is never touched.
 */
export function upsertSsoUser(profile: SsoProfile, provider: string): User {
  const existing = findByUsername(profile.username);
  if (existing) {
    const patch: Partial<User> = {};
    if (profile.email && profile.email !== existing.email) patch.email = profile.email;
    if (profile.displayName && profile.displayName !== existing.displayName)
      patch.displayName = profile.displayName;
    // The given/family name drives how the app addresses the person, so keep it
    // in sync too — a rename in the directory should show up here.
    if (profile.firstName && profile.firstName !== existing.firstName)
      patch.firstName = profile.firstName;
    if (profile.lastName && profile.lastName !== existing.lastName)
      patch.lastName = profile.lastName;
    // Sync role from the IdP, but never demote the permanent built-in admin.
    if (profile.role && profile.role !== existing.role && !isBuiltinAdmin(existing))
      patch.role = profile.role;
    if (Object.keys(patch).length) {
      updateUser(existing.id, patch);
      return { ...existing, ...patch };
    }
    return existing;
  }
  return createUser(profile.username, "", {
    provider,
    role: profile.role,
    email: profile.email,
    displayName: profile.displayName,
    firstName: profile.firstName,
    lastName: profile.lastName,
  });
}

/** Username rules: no whitespace, no colon (the model-key separator), 3..80. */
export function validateUsername(name: string): string | null {
  const v = name.trim();
  if (v.length < 3) return "Benutzername muss mindestens 3 Zeichen haben.";
  if (v.length > 80) return "Benutzername ist zu lang (max. 80 Zeichen).";
  if (/\s/.test(v)) return "Benutzername darf keine Leerzeichen enthalten.";
  return null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Fields an admin (or, for a subset, the user) may change on an account. */
export interface ProfilePatch {
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
}

/**
 * Apply a profile patch. Returns null on success or a German error message.
 *
 * Only keys present in `patch` are touched, so a form can send just what it
 * edits. An empty string clears an optional field; `username` cannot be cleared,
 * must stay unique, and is refused for the built-in admin (it is the guaranteed
 * recovery account and its name is referenced in the docs).
 */
export function setUserProfile(id: string, patch: ProfilePatch): string | null {
  const users = load();
  const u = users.find((x) => x.id === id);
  if (!u) return "Benutzer nicht gefunden.";

  const next: Partial<User> = {};

  if (patch.username !== undefined) {
    const name = patch.username.trim();
    if (name.toLowerCase() !== u.username.toLowerCase()) {
      if (isBuiltinAdmin(u)) return "Der Built-in-Administrator kann nicht umbenannt werden.";
      const err = validateUsername(name);
      if (err) return err;
      if (users.some((x) => x.id !== id && x.username.toLowerCase() === name.toLowerCase()))
        return "Benutzername bereits vergeben.";
      next.username = name;
    }
  }

  if (patch.email !== undefined) {
    const mail = patch.email.trim().slice(0, 200);
    if (mail && !EMAIL_RE.test(mail)) return "E-Mail-Adresse ist ungültig.";
    next.email = mail || undefined;
  }

  const clean = (v: string) => v.trim().replace(/\s+/g, " ").slice(0, 100);
  for (const k of ["firstName", "lastName"] as const) {
    if (patch[k] === undefined) continue;
    next[k] = clean(patch[k]!) || undefined;
  }

  // The display name is derived unless someone typed one. An EMPTY value means
  // "derive it" (that is what the edit dialog's hint promises), not "clear it" —
  // an account with no display name at all would fall back to the login id.
  const first = next.firstName !== undefined ? next.firstName : u.firstName;
  const last = next.lastName !== undefined ? next.lastName : u.lastName;
  const derived = [first, last].filter(Boolean).join(" ") || undefined;
  if (patch.displayName !== undefined) {
    next.displayName = clean(patch.displayName) || derived;
  } else if (next.firstName !== undefined || next.lastName !== undefined) {
    // A name changed and nobody ever typed a custom display name → keep it in
    // sync. A hand-written one is left alone.
    const derivedBefore = [u.firstName, u.lastName].filter(Boolean).join(" ");
    if (!u.displayName || u.displayName === derivedBefore) next.displayName = derived;
  }

  if (Object.keys(next).length) updateUser(id, next);
  return null;
}

/** Admin: turn off a user's 2FA (recovery when they lost their authenticator). */
export function clearTwoFactor(id: string): boolean {
  const u = findById(id);
  if (!u) return false;
  updateUser(id, { twoFactor: { enabled: false } });
  return true;
}

/** Public view (no secrets). */
export function publicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    provider: u.provider,
    kbCategories: u.kbCategories ?? [],
    twoFactorEnabled: u.twoFactor.enabled,
    blocked: !!u.blocked,
    builtin: isBuiltinAdmin(u),
  };
}

/** May this user create/upload/delete knowledge (admins + powerusers). */
export function canManageKb(u: { role: string }): boolean {
  return u.role === "admin" || u.role === "poweruser";
}

/**
 * The knowledge-base categories this user may access, intersected with the
 * categories that actually exist. Admins get ALL categories implicitly; everyone
 * else is default-deny (only what the admin explicitly granted).
 */
export function allowedCategoryIds(
  u: { role: string; kbCategories?: string[] },
  allCategoryIds: string[]
): string[] {
  if (u.role === "admin") return allCategoryIds;
  const granted = new Set(u.kbCategories ?? []);
  return allCategoryIds.filter((id) => granted.has(id));
}

/** Admin: set a user's KB category ACL (never for the built-in admin — no-op). */
export function setUserKbCategories(id: string, categoryIds: string[]): boolean {
  const users = load();
  const u = users.find((x) => x.id === id);
  if (!u) return false;
  const clean = Array.from(
    new Set((categoryIds ?? []).filter((c) => typeof c === "string" && c))
  ).slice(0, 500);
  updateUser(id, { kbCategories: clean });
  return true;
}

/** Grant one category to a user (used when a poweruser creates a category). */
export function grantCategory(id: string, categoryId: string): void {
  const u = findById(id);
  if (!u) return;
  const next = Array.from(new Set([...(u.kbCategories ?? []), categoryId]));
  updateUser(id, { kbCategories: next });
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

/** Admin: set/clear a user's email (used for password-reset delivery). */
export function setUserEmail(id: string, email: string): boolean {
  const users = load();
  const u = users.find((x) => x.id === id);
  if (!u) return false;
  const clean = email.trim().slice(0, 200);
  // Light sanity check: allow empty (clear) or a plausible address.
  if (clean && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return false;
  updateUser(id, { email: clean || undefined });
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
