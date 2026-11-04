// Builds data/builtins.json from the repository's docs: the built-in namespaces and their
// functions from docs/06-stdlib/01-builtins.md, and the keyword and type notes below, each
// naming the page under docs/ that explains it. With --check, fails if the committed file is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const repo = here("../../");

/** One line on each keyword, and the page that says the rest. */
const KEYWORDS = {
  as: [
    "Converts a value to a type, renames an import, or binds a pattern.",
    "02-types/01-scalars.md",
  ],
  await: ["Reserved for future use.", "01-lexical.md"],
  bits: [
    "`bits[...]` packs a binary layout into Bytes, or takes Bytes apart as a pattern.",
    "04-expressions/04-bits.md",
  ],
  break: ["Leaves the innermost loop.", "03-statements/02-control-flow.md"],
  catch: [
    "`try { ... } catch (e) { ... }` runs the handler with what the body threw.",
    "03-statements/04-exceptions.md",
  ],
  const: [
    "Binds a name that is never reassigned; a constant's value folds where it is read.",
    "03-statements/01-bindings.md",
  ],
  continue: ["Starts the innermost loop's next pass.", "03-statements/02-control-flow.md"],
  do: [
    "`do { ... } while (c);` runs its body before testing; `do:` ends a comprehension's generators.",
    "03-statements/02-control-flow.md",
  ],
  else: [
    "The branch an `if` takes when its condition fails; also `let ... else` and `with ... else`.",
    "03-statements/02-control-flow.md",
  ],
  enum: ["Declares a type whose values are one of its variants.", "02-types/05-enums.md"],
  export: ["Lets other modules import a top-level declaration.", "05-modules.md"],
  false: ["The Bool false.", "02-types/01-scalars.md"],
  fn: ["A function: `fn(x: I32): I32 { x + 1 }`.", "02-types/04-functions.md"],
  for: [
    "`for (x in xs)` and `for (i, x in xs)` loop over an Array, Bytes or List; also a comprehension's generator.",
    "03-statements/02-control-flow.md",
  ],
  from: ["Names the module an import takes from.", "05-modules.md"],
  if: [
    "Runs a branch when a condition holds; `if (let p = v)` tests a pattern.",
    "03-statements/02-control-flow.md",
  ],
  import: ["Takes exported names from another module.", "05-modules.md"],
  is: [
    "Tests a value's type: `v is I32`; also a pattern.",
    "02-types/02-nullability-and-dynamic.md",
  ],
  let: [
    "Binds a name, or a pattern; `let ... else` handles a pattern that fails.",
    "03-statements/01-bindings.md",
  ],
  list: [
    "`list[1, 2]` is a List; `list[for x <- xs, do: f(x)]` a comprehension.",
    "02-types/03-collections.md",
  ],
  load: ["`load { name } from library;` binds native functions of a JDLL.", "05-modules.md"],
  macro: ["Declares a macro, run at compile time to produce code.", "03-statements/05-macros.md"],
  match: ["Picks the first arm whose pattern matches a value.", "03-statements/03-patterns.md"],
  new: [
    "Constructs a value from a prototype, running its `init`.",
    "04-expressions/03-objects-and-prototypes.md",
  ],
  null: [
    "The absent value, of every nullable type `?T`.",
    "02-types/02-nullability-and-dynamic.md",
  ],
  package: [
    "Declares the package a module lives in: its import path less its own name.",
    "05-modules.md",
  ],
  prototype: [
    "Declares an object that others delegate to, with methods and an `init`.",
    "04-expressions/03-objects-and-prototypes.md",
  ],
  return: ["Leaves the function with a value.", "03-statements/02-control-flow.md"],
  super: [
    "The prototype a method's own prototype delegates to.",
    "04-expressions/03-objects-and-prototypes.md",
  ],
  this: ["The object a method was called on.", "04-expressions/03-objects-and-prototypes.md"],
  throw: ["Throws a value, for a `catch` to handle.", "03-statements/04-exceptions.md"],
  true: ["The Bool true.", "02-types/01-scalars.md"],
  try: ["Runs a body, handing anything it throws to `catch`.", "03-statements/04-exceptions.md"],
  type: ["`import type { T } from m;` imports types only.", "05-modules.md"],
  typedef: ["Declares an alias, a record, a byte layout or an abstract type.", "02-types/06-typedefs-and-records.md"],
  when: ["A guard: `pattern when (condition) =>`.", "03-statements/03-patterns.md"],
  while: [
    "Loops while a condition holds; `while (let p = v)` while a pattern matches.",
    "03-statements/02-control-flow.md",
  ],
  with: [
    "Runs a body when every `pattern <- value` clause matches, else its `else` arms.",
    "03-statements/03-patterns.md",
  ],
};

/** Words that are names to the lexer but mean something in certain places. */
const CONTEXTUAL = {
  method: [
    "Before `fn`: a function that sees `this`.",
    "04-expressions/03-objects-and-prototypes.md",
  ],
  quote: [
    "In a macro body, `quote.expr { ... }` (or `.stmt`, `.stmts`, `.pat`, `.type`) is code as data.",
    "03-statements/05-macros.md",
  ],
  unquote: ["Inside a quote, splices a fragment in.", "03-statements/05-macros.md"],
  in: [
    "Separates a `for` loop's names from what it loops over.",
    "03-statements/02-control-flow.md",
  ],
};

const TYPES = {
  I8: "8-bit signed integer, −128 to 127.",
  I16: "16-bit signed integer, −32 768 to 32 767.",
  I32: "32-bit signed integer; what an unsuffixed integer literal is when nothing fixes it.",
  I64: "64-bit signed integer.",
  U8: "8-bit unsigned integer, 0 to 255.",
  U16: "16-bit unsigned integer, 0 to 65 535.",
  U32: "32-bit unsigned integer.",
  U64: "64-bit unsigned integer.",
  F16: "Half-precision float, about 3 decimal digits.",
  F32: "Single-precision float, about 7 decimal digits.",
  F64: "Double-precision float; what an unsuffixed float literal is when nothing fixes it.",
  Bool: "`true` or `false`.",
  Bytes: "An immutable run of bytes; text is UTF-8 Bytes.",
  ByteBuffer: "A mutable buffer from `Bytes.new(n)`.",
  Atom: "An interned name, `:ok`.",
  Null: "The type of `null`.",
  Dynamic: "Any value, with its type checked at run time; made with `as Dynamic`.",
  Object: "A prototype-based object of named fields.",
  Array: "`Array<T>`: a growable array.",
  List: "`List<T>`: an immutable linked list.",
  Tuple: 'A fixed group of values, `(1, "one")`.',
};

const TYPE_PAGES = {
  Array: "02-types/03-collections.md",
  List: "02-types/03-collections.md",
  Tuple: "02-types/03-collections.md",
  Object: "04-expressions/03-objects-and-prototypes.md",
  Dynamic: "02-types/02-nullability-and-dynamic.md",
  Null: "02-types/02-nullability-and-dynamic.md",
};

/** The built-in functions, one entry for each signature in the builtins page's tables. */
function builtins() {
  const page = readFileSync(`${repo}docs/06-stdlib/01-builtins.md`, "utf8");
  const out = [];
  let section = "";
  for (const line of page.split("\n")) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      section = heading[1].trim();
      continue;
    }
    const row = /^\| (.+?) \| (.+) \|$/.exec(line);
    if (!row || row[1] === "Function" || row[1] === "Member" || /^-+$/.test(row[1])) continue;
    const description = row[2].trim();
    const staticOnly = /static only/.test(description);
    for (const [, code] of row[1].matchAll(/`([^`]+)`/g)) {
      const m = /^(?:([A-Z]\w*)\.)?([a-z_]\w*)(.*)$/.exec(code);
      if (!m) continue;
      // A bare name is a method form (`t.len()`) unless the section is a namespace of its own.
      const namespace = m[1] ?? (section === "Math" ? "Math" : undefined);
      if (!namespace) continue;
      out.push({
        namespace,
        name: m[2],
        signature: `${namespace}.${m[2]}${m[3]}`,
        description,
        method:
          !staticOnly &&
          !["new", "intern"].includes(m[2]) &&
          !["Std", "System", "Math", "Float", "Integer"].includes(namespace),
      });
    }
  }
  // One entry per name: the first signature of an overloaded one, with the others noted.
  const byName = new Map();
  for (const entry of out) {
    const key = `${entry.namespace}.${entry.name}`;
    const seen = byName.get(key);
    if (seen) seen.overloads = [...(seen.overloads ?? []), entry.signature];
    else byName.set(key, entry);
  }
  return [...byName.values()];
}

const pages = (table) =>
  Object.fromEntries(Object.entries(table).map(([k, [text, page]]) => [k, { text, page }]));

const data = {
  generatedFrom: ["docs/06-stdlib/01-builtins.md", "scripts/gen-data.mjs"],
  keywords: pages(KEYWORDS),
  contextual: pages(CONTEXTUAL),
  types: Object.fromEntries(
    Object.entries(TYPES).map(([k, text]) => [
      k,
      { text, page: TYPE_PAGES[k] ?? "02-types/01-scalars.md" },
    ]),
  ),
  namespaces: [
    "Std",
    "System",
    "Math",
    "Float",
    "Integer",
    "Array",
    "Bytes",
    "List",
    "Object",
    "Tuple",
    "Atom",
    "Enum",
    "Function",
  ],
  functions: builtins(),
};

const text = JSON.stringify(data, null, 2) + "\n";
const target = here("../data/builtins.json");
if (process.argv.includes("--check")) {
  let old = "";
  try {
    old = readFileSync(target, "utf8");
  } catch {
    /* missing is stale */
  }
  if (old !== text) {
    console.error("data/builtins.json is stale: run `npm run gen`");
    process.exit(1);
  }
} else {
  writeFileSync(target, text);
  console.log(`data/builtins.json: ${data.functions.length} functions`);
}
