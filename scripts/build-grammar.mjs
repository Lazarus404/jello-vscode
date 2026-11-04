// Writes the grammars from syntaxes/jello.grammar.mjs to the JSON files VS Code loads.
// With --check, writes nothing and fails if the JSON is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { grammar, markdownInjection } from "../syntaxes/jello.grammar.mjs";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const outputs = [
  [here("../syntaxes/jello.tmLanguage.json"), grammar],
  [here("../syntaxes/jello-markdown.tmLanguage.json"), markdownInjection],
];
const check = process.argv.includes("--check");
let stale = [];

for (const [path, value] of outputs) {
  const text = JSON.stringify(value, null, 2) + "\n";
  if (!check) {
    writeFileSync(path, text);
    continue;
  }
  let old = "";
  try {
    old = readFileSync(path, "utf8");
  } catch {
    /* missing counts as stale */
  }
  if (old !== text) stale.push(path);
}
if (stale.length > 0) {
  console.error(
    `stale grammar JSON, run \`node scripts/build-grammar.mjs\`:\n  ${stale.join("\n  ")}`,
  );
  process.exit(1);
}
