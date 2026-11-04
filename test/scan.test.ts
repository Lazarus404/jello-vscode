import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenize } from "../src/core/lexer";
import { scan, signature } from "../src/core/scan";

const SOURCE = `package geometry;

import { map, first as head } from std.core.Array;
import type { Test } from std.testing;
import std.testing as T;
load { unicode_length } from std;

/** The area of a shape.
 * @param shape  what to measure */
export let area = fn(shape: Shape): I32 {
  let s = "{ not a block";
  let t = \`\${ { x: 1 }.x } }\`;
  match (shape) { Square(side) => side * side, Circle(r) => 3 * r * r }
};

// Shapes we know.
export enum Shape {
  Square(side: I32);
  /** Round. */
  Circle(radius: I32);
  Dot;
}

typedef Point = { let x: I32; let y: I32; };
typedef Message = bytes-layout { let kind: u8; let body: rest; };
typedef Names = Array<Bytes>;

prototype Counter {
  count: 0;
  init(start: I32) { this.count = start; };
  bump(by: I32 = 1): I32 { this.count = (this.count as I32) + by; this.count as I32 };
};

const LIMIT = 10;
let twice<T: Eq> = fn(x: T, ?y: T, ...rest: T): Array<T> { [x, x] };
let typed: (I32) -> Bytes = fn(n) { Std.string(n) };
macro double(x) { quote.expr { unquote(x) * 2 } }

let total = fn(xs: Array<I32>): I32 {
  let sum = 0;
  for (i, x in xs) { sum += x; }
  try { sum } catch (e) { 0 }
};
let tag = :ok;
`;

test("the tokenizer keeps strings, templates and regexps whole", () => {
  const kinds = tokenize('let s = "a{b" + `x${ {a: 1}.a }` + ~r/a\\/b/i; # c\n:atom {a:b}');
  assert.deepEqual(
    kinds
      .filter((t) => t.kind !== "punct" && t.kind !== "ident" && t.kind !== "keyword")
      .map((t) => [t.kind, t.text]),
    [
      ["string", '"a{b"'],
      ["template", "`x${ {a: 1}.a }`"],
      ["regexp", "~r/a\\/b/i"],
      ["comment", "# c"],
      ["atom", ":atom"],
    ],
  );
  // A keyword after a dot is a member name.
  assert.equal(tokenize("o.type").at(-1)?.kind, "ident");
});

test("top-level declarations, with docs and signatures", () => {
  const s = scan(SOURCE);
  assert.equal(s.package?.path, "geometry");
  const names = s.declarations.map((d) => `${d.kind} ${d.name}${d.exported ? " (export)" : ""}`);
  assert.deepEqual(names, [
    "function area (export)",
    "enum Shape (export)",
    "typedef Point",
    "typedef Message",
    "typedef Names",
    "prototype Counter",
    "constant LIMIT",
    "function twice",
    "function typed",
    "macro double",
    "function total",
    "value tag",
  ]);
  const area = s.declarations[0];
  assert.equal(signature(area), "area(shape: Shape): I32");
  assert.match(area.doc ?? "", /^The area of a shape\.\n@param shape/);

  const shape = s.declarations[1];
  assert.equal(shape.doc, "Shapes we know.");
  assert.deepEqual(
    shape.children.map((c) => signature(c)),
    ["Square(side: I32)", "Circle(radius: I32)", "Dot"],
  );
  assert.equal(shape.children[1].doc, "Round.");

  assert.deepEqual(
    s.declarations[2].children.map((c) => `${c.name}: ${c.type}`),
    ["x: I32", "y: I32"],
  );
  assert.deepEqual(
    s.declarations[3].children.map((c) => c.name),
    ["kind", "body"],
  );
  assert.equal(s.declarations[4].type, "Array<Bytes>");

  const counter = s.declarations[5];
  assert.deepEqual(
    counter.children.map((c) => `${c.kind} ${c.name}`),
    ["field count", "method init", "method bump"],
  );
  assert.equal(signature(counter.children[2]), "bump(by: I32 = 1): I32");

  const twice = s.declarations[7];
  assert.equal(twice.typeParams, "<T: Eq>");
  assert.deepEqual(
    twice.params?.map((p) => [p.name, p.type, p.text]),
    [
      ["x", "T", "x: T"],
      ["y", "T", "?y: T"],
      ["rest", "T", "...rest: T"],
    ],
  );
  assert.equal(s.declarations[8].result, "Bytes");
});

test("imports in all their forms", () => {
  const s = scan(SOURCE);
  assert.deepEqual(
    s.imports.map((i) => [i.kind, i.module, i.names.map((n) => n.alias ?? n.name), i.alias]),
    [
      ["named", "std.core.Array", ["map", "head"], undefined],
      ["type", "std.testing", ["Test"], undefined],
      ["namespace", "std.testing", [], "T"],
      ["load", "std", ["unicode_length"], undefined],
    ],
  );
  const array = s.imports[0];
  assert.equal(SOURCE.slice(array.moduleStart, array.moduleEnd), "std.core.Array");
});

test("locals and parameters, with their scopes", () => {
  const s = scan(SOURCE);
  const at = (needle: string) => SOURCE.indexOf(needle);
  const visible = (offset: number) =>
    s.locals
      .filter(
        (l) =>
          l.scopeStart <= offset &&
          offset <= l.scopeEnd &&
          (l.kind === "param" || l.start < offset),
      )
      .map((l) => l.name);
  assert.deepEqual(visible(at("sum += x")).sort(), ["i", "sum", "x", "xs"]);
  assert.deepEqual(visible(at("catch (e) { 0")).sort(), ["sum", "xs"]);
  assert.ok(visible(at("{ 0 }") + 2).includes("e"));
  assert.ok(visible(at("side * side")).includes("shape"));
  assert.ok(!visible(at("let tag")).includes("sum"));
  assert.deepEqual(s.atoms, ["ok"]);
});
