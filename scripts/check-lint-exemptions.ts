// Fails when the staged .oxlintrc.json exempts more files from a rule than the
// committed one does. lint-staged runs it whenever .oxlintrc.json is staged.
// Usage: tsx scripts/check-lint-exemptions.ts

import { execFileSync } from "node:child_process";
import ts from "typescript";
import { grownExemptions } from "./lint-exemptions";

const CONFIG = ".oxlintrc.json";

// The config has comments, so JSON.parse cannot read it. TypeScript's own
// tsconfig reader can. A config that will not parse fails the check: a
// ratchet that cannot read the config is no ratchet.
const read = (spec: string) => {
  let text: string;
  try {
    text = execFileSync("git", ["show", spec], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null; // No such version, e.g. the first commit of the config.
  }
  const { config, error } = ts.parseConfigFileTextToJson(CONFIG, text);
  if (error) {
    console.error(`Cannot parse ${spec}:`);
    console.error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
    process.exit(1);
  }
  return config;
};

const before = read(`HEAD:${CONFIG}`);
const after = read(`:${CONFIG}`);

const grown = before && after ? grownExemptions(before, after) : [];

if (grown.length > 0) {
  for (const { rule, before: was, after: now, added } of grown) {
    console.error(`${rule} exemptions grew: ${was} → ${now}`);
    for (const file of added) console.error(`  added: ${file}`);
  }
  console.error(`
The exemption lists in ${CONFIG} only shrink. They name files that broke a
rule before the rule existed, not new ones.

Make the new code pass the rule instead: shorten the function, split the file.
When a split moves code out of an exempt file, the exemption can move with it,
as long as the list ends no longer than it started: remove the old entry when
you add the new one.`);
  process.exit(1);
}
