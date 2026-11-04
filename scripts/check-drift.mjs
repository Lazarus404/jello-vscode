// Fails when the extension and the language have drifted apart: the grammar, the tokenizer and
// the hover notes must know exactly the lexer's keywords and the checker's types, the docs'
// built-in functions must cover the compiler's, and the generated files must be fresh.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { KEYWORDS, TYPES } from "../syntaxes/jello.grammar.mjs";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const repo = here("../../");
const read = (path) => readFileSync(repo + path, "utf8");
const problems = [];

const same = (what, want, got) => {
  const missing = [...want].filter((w) => !got.has(w));
  const extra = [...got].filter((g) => !want.has(g));
  if (missing.length) problems.push(`${what} lacks: ${missing.join(", ")}`);
  if (extra.length) problems.push(`${what} has extra: ${extra.join(", ")}`);
};

// The lexer's keyword table is the truth.
const lexer = read("jelloc/src/frontend/syntax/Lexer.jello");
const table = /let _keywordToken = fn[\s\S]*?\n\};/.exec(lexer)?.[0] ?? "";
const keywords = new Set([...table.matchAll(/"([a-z]+)" => Token\./g)].map((m) => m[1]));
if (keywords.size < 30) problems.push("could not read the keyword table from Lexer.jello");

const groups = Object.values(KEYWORDS).flat();
same("grammar keyword groups", keywords, new Set(groups));
if (groups.length !== new Set(groups).size) problems.push("a keyword is in two grammar groups");

const tokenizer = readFileSync(here("../src/core/lexer.ts"), "utf8");
const set = /export const KEYWORDS = new Set\(\[([\s\S]*?)\]\)/.exec(tokenizer)?.[1] ?? "";
same(
  "src/core/lexer.ts KEYWORDS",
  keywords,
  new Set([...set.matchAll(/"(\w+)"/g)].map((m) => m[1])),
);

const data = JSON.parse(readFileSync(here("../data/builtins.json"), "utf8"));
same("data/builtins.json keywords", keywords, new Set(Object.keys(data.keywords)));

const lexical = read("docs/01-lexical.md");
const block = /## Keywords[\s\S]*?```text\n([\s\S]*?)```/.exec(lexical)?.[1] ?? "";
same("docs/01-lexical.md keyword list", keywords, new Set(block.split(/\s+/).filter(Boolean)));

// Every type name the checker resolves must be highlighted and described.
const checker = read("jelloc/src/frontend/semantics/TypeCheck.jello");
const named = new Set([...checker.matchAll(/"([A-Z][A-Za-z0-9]*)" => H\.TYPE_/g)].map((m) => m[1]));
if (named.size < 10) problems.push("could not read the built-in type names from TypeCheck.jello");
for (const name of named) {
  if (!TYPES.includes(name)) problems.push(`grammar TYPES lacks ${name}`);
  if (!data.types[name]) problems.push(`data/builtins.json types lacks ${name}`);
}

// Every intrinsic the compiler names must be documented, so completion and hover know it.
const documented = new Set(data.functions.map((f) => `${f.namespace}.${f.name}`));
const semantics = ["Aggregates", "TypeCheck", "Math", "Values", "Prototypes"]
  .map((m) => {
    try {
      return read(`jelloc/src/frontend/semantics/${m}.jello`);
    } catch {
      return "";
    }
  })
  .join("\n");
const spaces = data.namespaces.join("|");
for (const [, name] of semantics.matchAll(new RegExp(`"((?:${spaces})\\.[A-Za-z_]\\w*)"`, "g"))) {
  if (!documented.has(name))
    problems.push(`compiler intrinsic ${name} is not in the builtins docs`);
}
const math =
  /let _arity = fn[\s\S]*?\n\};/.exec(read("jelloc/src/frontend/semantics/Math.jello"))?.[0] ?? "";
for (const [, name] of math.matchAll(/"([a-z0-9]+)"/g)) {
  if (!documented.has(`Math.${name}`)) problems.push(`Math.${name} is not in the builtins docs`);
}

// std.testing's assertions live in the compiler, so the extension keeps its own list of them.
const assertions = /let _ASSERTIONS = \[([^\]]*)\]/.exec(
  read("jelloc/src/frontend/semantics/Testing.jello"),
)?.[1];
const listed = readFileSync(here("../src/moduleIndex.ts"), "utf8").matchAll(/^\s*\["(\w+)", \[/gm);
if (!assertions) problems.push("could not read _ASSERTIONS from Testing.jello");
else
  same(
    "std.testing assertions",
    new Set([...assertions.matchAll(/"(\w+)"/g)].map((m) => m[1])),
    new Set([...listed].map((m) => m[1])),
  );

// Generated files must match their sources.
for (const script of ["build-grammar.mjs", "gen-data.mjs"]) {
  try {
    execFileSync(process.execPath, [here(script), "--check"], { stdio: "pipe" });
  } catch (e) {
    problems.push(String(e.stderr || e.message).trim());
  }
}

if (problems.length > 0) {
  console.error("drift:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(
  `drift check: ${keywords.size} keywords, ${named.size} types, ${documented.size} built-ins agree`,
);
