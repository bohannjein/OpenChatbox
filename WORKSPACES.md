# Workspace State-Management — Architektur

Workspaces sind Kollaborationsräume. Chats, Sidekicks und geteilte Dateien
gehören zu genau **einem** Workspace; ein User kann Mitglied **mehrerer** sein.

## Zwei-Schichten-Modell

| Schicht | Ort | Wahrheit über | Warum |
|--------|-----|---------------|-------|
| **Client-Store** (Zustand) | `lib/store.ts` | Workspace-Liste + aktiver Workspace der Session; Zuordnung von Chats/Sidekicks (`workspaceId`) | schneller UI-Scope, offline, per-User via `nexus-uid`-Namespace |
| **Server-Registry** | `lib/server/workspaces.ts` (`data/workspaces.json`) | **Mitgliedschaft** (welche User dürfen einen Workspace sehen) | cross-user Kollaboration braucht geteilte Wahrheit |

Der Client spiegelt pro Session die Server-Workspaces des Users; die
Mitgliedschaft bleibt server-seitig, damit ein Workspace über Konten hinweg
teilbar ist.

## Datenmodell

```ts
// lib/types.ts
interface Workspace { id: string; name: string; createdAt: number }
interface Chat     { …; workspaceId?: string }   // undefined = Default-Workspace
interface Sidekick { …; workspaceId?: string }
```

- **Nicht-brechend:** bestehende Chats/Sidekicks haben kein `workspaceId` und
  werden über `inWorkspace(item, wsId)` dem Default-Workspace zugerechnet.
- **Default-Workspace** `ws-default` („Persönlich") existiert immer.

## Store-Slice (`lib/store.ts`)

```
state:   workspaces: Workspace[], activeWorkspaceId: string
actions: createWorkspace(name)→id, renameWorkspace, deleteWorkspace, switchWorkspace
helpers: DEFAULT_WORKSPACE_ID, inWorkspace(item, wsId)
```

- `newChat` und `upsertSidekick` stempeln automatisch `activeWorkspaceId` auf.
- `deleteWorkspace` löscht **keine Inhalte** — es reassigned Chats/Sidekicks
  auf den Default-Workspace (kein Datenverlust). Default ist unlöschbar.
- Persistenz: `workspaces` + `activeWorkspaceId` in `partialize`; `migrate`
  (v2→v3) legt den Default-Workspace an.

## Scoping / Selektor

`inWorkspace(item, activeWorkspaceId)` ist der einzige Filter. Die Sidebar
filtert Chats **und** Sidekicks darüber; `WorkspaceSwitcher` schaltet um.

## Was jetzt live ist vs. gestaffelt

- **Live:** Store-Slice, Typen, Migration, Sidebar-Filter + Switcher,
  Server-Registry + `GET/POST/DELETE /api/workspaces`.
- **Nächste Stufe (Enforcement/Kollab):** Server↔Client-Sync der Mitgliedschaft,
  Einladungen, geteilte Dateien server-seitig, Rollen-Enforcement pro Workspace,
  Umzug von Chats zwischen Workspaces im UI.
