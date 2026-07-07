/**
 * Publish a GitHub release whose notes are the in-app changelog — so the
 * Releases page and Settings → "Über OpenChatbox / Info" never drift apart.
 *
 * Usage (from the repo root):
 *   npx tsx scripts/release.ts            # release the top changelog entry
 *   npx tsx scripts/release.ts 0.9.0      # release a specific version
 *
 * Source of truth: lib/version.ts (APP_VERSION + CHANGELOG). Bump those, then
 * run this. It creates + pushes the annotated tag vX.Y.Z and publishes the
 * matching GitHub release via the `gh` CLI (falls back to printing manual
 * instructions if `gh` is not installed / not authenticated).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_VERSION, CHANGELOG, LATEST_WHATS_NEW } from "../lib/version";

const arg = process.argv[2]?.replace(/^v/, "").trim();
const version = arg || LATEST_WHATS_NEW || APP_VERSION;
const entry = CHANGELOG.find((e) => e.version === version);

if (!entry) {
  console.error(
    `✗ No changelog entry for ${version} in lib/version.ts. Add it there first.`
  );
  process.exit(1);
}

const tag = `v${version}`;
const title = `OpenChatbox ${tag}`;
const notes =
  `Released ${entry.date}.\n\n` + entry.items.map((i) => `- ${i}`).join("\n") + "\n";

const sh = (cmd: string) => execSync(cmd, { stdio: "pipe" }).toString().trim();
const has = (cmd: string) => {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

// 1) Tag (idempotent) + push.
const tagExists = has(`git rev-parse -q --verify refs/tags/${tag}`);
if (!tagExists) {
  console.log(`▶ Creating tag ${tag}…`);
  sh(`git tag -a ${tag} -m "${title}"`);
}
console.log(`▶ Pushing ${tag}…`);
try {
  sh(`git push origin ${tag}`);
} catch {
  /* already pushed — fine */
}

// 2) Publish the GitHub release (or fall back to manual instructions).
const notesFile = path.join(os.tmpdir(), `openchatbox-${tag}-notes.md`);
fs.writeFileSync(notesFile, notes, "utf8");

if (has("gh --version")) {
  const exists = has(`gh release view ${tag}`);
  const action = exists ? "edit" : "create";
  console.log(`▶ ${exists ? "Updating" : "Creating"} GitHub release ${tag}…`);
  execSync(
    `gh release ${action} ${tag} --title "${title}" --notes-file "${notesFile}"`,
    { stdio: "inherit" }
  );
  console.log(`✓ Release ${tag} published.`);
} else {
  console.log(
    `\n! 'gh' CLI not found — the tag ${tag} is pushed, but publish the release manually:\n` +
      `\n  Web UI:  https://github.com/bohannjein/OpenChatbox/releases/new?tag=${tag}` +
      `\n  or gh :  gh release create ${tag} --title "${title}" --notes-file "${notesFile}"\n` +
      `\n--- release notes (${tag}) ---\n${notes}`
  );
}
