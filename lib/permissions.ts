/** A custom, admin-editable role: a named set of permission keys. */
export interface Role {
  id: string;
  name: string;
  permissions: string[];
  /** built-in roles (admin/user) can be edited but not deleted. */
  builtin?: boolean;
}

/** The catalog of assignable permissions shown as checkboxes in the editor. */
export const PERMISSIONS = [
  { key: "models.pull", label: "Darf Modelle pullen", desc: "Neue Modelle vom Ollama-Server laden." },
  { key: "models.delete", label: "Darf Modelle löschen", desc: "Installierte Modelle vom Server entfernen." },
  { key: "workspaces.create", label: "Darf Workspaces erstellen", desc: "Neue Kollaborationsräume anlegen." },
  { key: "workspaces.delete", label: "Darf Workspaces löschen", desc: "Workspaces samt Zuordnung entfernen." },
  { key: "files.share", label: "Darf Dokumente teilen", desc: "Dateien in Workspaces mit anderen teilen." },
  { key: "chats.share", label: "Darf Chats teilen", desc: "Öffentliche Chat-Freigabe-Links erzeugen." },
  { key: "users.manage", label: "Darf Benutzer verwalten", desc: "Konten anlegen, sperren, Rollen zuweisen." },
  { key: "roles.manage", label: "Darf Rollen verwalten", desc: "Eigene Rollen erstellen und Rechte vergeben." },
  { key: "terminal.access", label: "Darf Server-Terminal nutzen", desc: "Admin-Terminal / Ollama-Befehle ausführen." },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export const ALL_PERMISSIONS: string[] = PERMISSIONS.map((p) => p.key);
