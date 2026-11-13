// Runs check-file-tokens.js on every file this branch changes: committed since
// it left main, staged, unstaged or untracked. The pre-commit hook checks the
// same limit, but only at commit time, after the work is done. This brings the
// failure forward to `npm run check`.
// Usage: node scripts/check-changed-file-tokens.js

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);

const base = ["origin/main", "main"].find((ref) => {
  try {
    git("rev-parse", "--verify", "--quiet", ref);
    return true;
  } catch {
    return false;
  }
});

const changed = new Set([
  ...(base ? git("diff", "--name-only", `${base}...HEAD`) : []),
  ...git("diff", "--name-only", "HEAD"),
  ...git("ls-files", "--others", "--exclude-standard"),
]);

const files = [...changed].filter((file) => existsSync(file));

if (files.length > 0) {
  const result = spawnSync(
    process.execPath,
    ["scripts/check-file-tokens.js", ...files],
    { stdio: "inherit" }
  );
  process.exit(result.status ?? 1);
}
