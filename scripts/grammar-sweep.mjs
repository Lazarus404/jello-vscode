// Tokenises every Jello source in the repository, and the ```jello fences in docs/, and fails on
// a file whose brackets, blocks or templates leave the grammar's rule stack unbalanced at its
// end, or on an illegal token in a program that compiles.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGrammar, tokenise } from "./tm.mjs";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const roots = ["jelloc/src", "stdlib", "jelloc/tests/e2e/programs", "jelloc/tests/unit"];

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".jello")) out.push(path);
  }
  return out;
};

/** The fenced ```jello blocks of a Markdown file, with their first line numbers. */
const fences = (path) => {
  const blocks = [];
  let current = null;
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (current === null && /^```jello\b/.test(line)) current = { start: i + 2, lines: [] };
      else if (current !== null && /^```\s*$/.test(line)) {
        blocks.push(current);
        current = null;
      } else if (current !== null) current.lines.push(line);
    });
  return blocks.map((b) => ({ start: b.start, text: b.lines.join("\n") }));
};

const grammar = await loadGrammar();
const failures = [];
let checked = 0;

const check = (name, text, expectsErrors) => {
  checked++;
  // A lexical or parse error may leave anything open; a type error still parses.
  if (expectsErrors && /\[E0[01]\d\d\]/.test(text)) return;
  const tokens = tokenise(grammar, text);
  const last = tokens.filter((t) => t.end).at(-1);
  if (last && last.depth !== 1) failures.push(`${name}: rule stack depth ${last.depth} at the end`);
  if (expectsErrors) return;
  const bad = tokens.find((t) => !t.end && t.scopes.some((s) => s.startsWith("invalid.")));
  if (bad) failures.push(`${name}:${bad.line + 1}: illegal token ${JSON.stringify(bad.text)}`);
};

// A fixture that is meant not to compile may hold any text at all.
const failing = (path, text) =>
  /[\\/]errors?[\\/]/.test(path) || /^\/\/\s*(error|trap|lex-error|parse-error):/m.test(text);

for (const root of roots) {
  for (const path of walk(join(repo, root))) {
    const text = readFileSync(path, "utf8");
    check(relative(repo, path), text, failing(path, text));
  }
}
for (const path of walk(join(repo, "docs"), []).concat(
  readdirSync(join(repo, "docs"), { recursive: true })
    .filter((n) => n.endsWith(".md"))
    .map((n) => join(repo, "docs", n)),
)) {
  if (!path.endsWith(".md")) continue;
  for (const block of fences(path)) {
    check(`${relative(repo, path)}:${block.start}`, block.text, /^\/\/\s*error:/m.test(block.text));
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  console.error(`\n${failures.length} of ${checked} sources failed the grammar sweep`);
  process.exit(1);
}
console.log(`grammar sweep: ${checked} sources clean`);
