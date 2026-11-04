import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCompilerOutput, parseTrap } from "../src/core/diagnostics";

test("errors, with codes, skipping source lines and carets", () => {
  const out = parseCompilerOutput(
    [
      "/w/e.jello:1:14: x is annotated I32, but its value is Bytes [E0400]",
      'let x: I32 = "a";',
      "             ^",
      "/w/e.jello:2:9: unknown name: z [E0300]",
      "let y = z;",
      "        ^",
    ].join("\n"),
  );
  assert.equal(out.diagnostics.length, 2);
  assert.deepEqual(
    { ...out.diagnostics[0], notes: undefined },
    {
      file: "/w/e.jello",
      line: 1,
      column: 14,
      severity: "error",
      message: "x is annotated I32, but its value is Bytes",
      code: "E0400",
      notes: undefined,
    },
  );
  assert.equal(out.diagnostics[1].code, "E0300");
  assert.equal(out.stopped, false);
});

test("a source line that looks like a diagnostic is still a source line", () => {
  const out = parseCompilerOutput(
    ["/w/a.jello:3:1: unknown name: q [E0300]", 'b.jello:1:2: "not a header"', "^"].join("\n"),
  );
  assert.equal(out.diagnostics.length, 1);
});

test("notes attach to the error before them", () => {
  const out = parseCompilerOutput(
    [
      "/w/main.jello:1:1: /w/geo/P.jello declares `package geox;`, but importing it as `geo.P` needs `package geo;` [E0202]",
      "import { o } from geo.P;",
      "^",
      "/w/geo/P.jello:1:1: note: its package is declared here",
      "package geox;",
      "^",
    ].join("\n"),
  );
  assert.equal(out.diagnostics.length, 1);
  assert.equal(out.diagnostics[0].code, "E0202");
  assert.match(out.diagnostics[0].message, /declares `package geox;`/);
  assert.deepEqual(out.diagnostics[0].notes, [
    { file: "/w/geo/P.jello", line: 1, column: 1, message: "its package is declared here" },
  ]);
});

test("warnings have no code", () => {
  const out = parseCompilerOutput(
    [
      "/w/w.jello:1:16: warning: this clause cannot fail: use `let`",
      "let sum = with (a, b) <- (1, 2) { a + b } else { _ => 0 };",
      "               ^",
    ].join("\n"),
  );
  assert.equal(out.diagnostics[0].severity, "warning");
  assert.equal(out.diagnostics[0].code, undefined);
  assert.equal(out.diagnostics[0].message, "this clause cannot fail: use `let`");
});

test("a labelled --parse failure, reported twice, is reported once", () => {
  const out = parseCompilerOutput(
    [
      "LEXER\t/w/l.jello:1:9: unterminated bytes literal [E0005]",
      'let x = "abc',
      "        ^",
      "/w/l.jello:1:9: unterminated bytes literal [E0005]",
      'let x = "abc',
      "        ^",
    ].join("\n"),
  );
  assert.equal(out.diagnostics.length, 1);
  assert.equal(out.diagnostics[0].file, "/w/l.jello");
});

test("the error limit and internal errors", () => {
  const out = parseCompilerOutput("/w/m.jello:20:16: a [E0400]\nx\n^\nstopped after 20 errors\n");
  assert.equal(out.stopped, true);
  const bug = parseCompilerOutput(
    "internal error: verify failed (please report this compiler bug)\n",
  );
  assert.match(bug.internal ?? "", /please report/);
  const other = parseCompilerOutput("jelloc: cannot read main.jello\n");
  assert.deepEqual(other.other, ["jelloc: cannot read main.jello"]);
});

test("traps, with what was thrown", () => {
  const trap = parseTrap(
    "main.jello:1:1: jellovm: trap UNCAUGHT_THROW in function 0 at pc 2\njellovm: thrown: boom\n",
  );
  assert.equal(trap?.name, "UNCAUGHT_THROW");
  assert.equal(trap?.thrown, "boom");
  assert.equal(trap?.line, 1);
  const current = parseTrap("main.jello:2:3: jello: trap BOUNDS in function 0 at pc 6\n");
  assert.equal(current?.name, "BOUNDS");
  assert.equal(current?.column, 3);
  assert.equal(parseTrap("main.jello:1:1: jello: trap UNCAUGHT_THROW\njello: thrown: x\n")?.thrown, "x");
  assert.equal(parseTrap("all fine\n"), undefined);
});
