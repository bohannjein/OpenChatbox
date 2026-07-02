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
  twoFactor: { enabled: boolean; secret?: string; pending?: string };
  createdAt: number;
}

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

/** Total number of registered users. */
export function countUsers(): number {
  return load().length;
}

/**
 * True once at least one admin account exists. Drives the first-run setup gate:
 * a fresh install has no admin, so the setup screen is shown until the first
 * admin is created. (There is intentionally no default/seed admin — leaving
 * `administrator/administrator` around would be an obvious security hole.)
 */
export function hasAdmin(): boolean {
  try {
    // No file at all → genuinely fresh install → setup needed.
    if (!fs.existsSync(FILE)) return false;
    const users = (JSON.parse(fs.readFileSync(FILE, "utf8")).users as User[]) ?? [];
    return users.some((u) => u.role === "admin");
  } catch {
    // File exists but is unreadable/corrupt: fail CLOSED. Assume an admin may
    // exist so the setup gate can't be re-opened (and a second admin created)
    // on an already-provisioned instance due to a transient read error.
    return true;
  }
}

export function findByUsername(username: string): User | undefined {
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

/** Find a linked SSO user or create one on first login. */
export function upsertSsoUser(username: string, provider: string): User {
  const existing = findByUsername(username);
  if (existing) return existing;
  return createUser(username, "", { provider });
}

/** Public view (no secrets). */
export function publicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    provider: u.provider,
    twoFactorEnabled: u.twoFactor.enabled,
  };
}
