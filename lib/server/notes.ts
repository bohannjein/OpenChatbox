import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";

// Per-user notes (cross-chat), keyed by user id, in the persistent /data volume.
const FILE = path.join(DATA_DIR, "notes.json");
const MAX = 200_000;

function loadAll(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}
function saveAll(map: Record<string, string>) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(map, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

export function getNotes(userId: string): string {
  return loadAll()[userId] ?? "";
}
export function setNotes(userId: string, text: string) {
  const map = loadAll();
  map[userId] = String(text ?? "").slice(0, MAX);
  saveAll(map);
}
