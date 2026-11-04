import assert from "node:assert/strict";
import { test } from "node:test";
import { declaredTests, gotWant, parseRun, testPrefix } from "../src/core/tests";

const VERBOSE = [
  "=== RUN   Ar/testGood",
  "--- PASS: Ar/testGood (tests/Ar.test.jello:4)",
  "=== RUN   Ar/testBad",
  "--- FAIL: Ar/testBad (tests/Ar.test.jello:8)",
  "    tests/Ar.test.jello:9:3: got [1, 2], want [1, 3]",
  "    note",
  "=== RUN   Ar/testSub",
  "=== RUN   Ar/testSub/inner",
  "--- FAIL: Ar/testSub/inner",
  "    tests/Ar.test.jello:14:35: got false, want true",
  "--- FAIL: Ar/testSub (tests/Ar.test.jello:13)",
  "=== RUN   Ar/testSlow",
  "--- SKIP: Ar/testSlow (tests/Ar.test.jello:20)",
  "    pass --slow to run it",
  "FAIL",
].join("\n");

test("the runner's verbose output", () => {
  const run = parseRun(VERBOSE);
  assert.equal(run.passed, false);
  assert.deepEqual(run.started, [
    "Ar/testGood",
    "Ar/testBad",
    "Ar/testSub",
    "Ar/testSub/inner",
    "Ar/testSlow",
  ]);
  const byName = new Map(run.results.map((r) => [r.name, r]));
  assert.equal(byName.get("Ar/testGood")?.outcome, "passed");
  assert.equal(byName.get("Ar/testSlow")?.outcome, "skipped");
  const bad = byName.get("Ar/testBad")!;
  assert.equal(bad.outcome, "failed");
  assert.equal(bad.line, 8);
  assert.deepEqual(bad.messages, [
    { text: "got [1, 2], want [1, 3]", file: "tests/Ar.test.jello", line: 9, column: 3 },
    { text: "note" },
  ]);
  assert.equal(byName.get("Ar/testSub/inner")?.file, undefined);
  assert.equal(parseRun("=== RUN   A/testX\nok\n").passed, true);
});

test("expected and actual values of a failed assertion", () => {
  assert.deepEqual(gotWant("got [1, 2], want [1, 3]"), { got: "[1, 2]", want: "[1, 3]" });
  assert.equal(gotWant("threw boom"), undefined);
});

test("only test followed by an upper-case letter names a test", () => {
  const source = [
    "import type { Test } from std.testing;",
    "let testing = fn(t: Test) {};",
    "let testOne = fn(t: Test) { };",
    "let helper = fn() {};",
    "let test_case = 1;",
    "let testTwo = fn(t: Test) { let testInner = fn(t: Test) {}; };",
  ].join("\n");
  assert.deepEqual(
    declaredTests(source).map((t) => t.name),
    ["testOne", "testTwo"],
  );
  assert.equal(testPrefix("app/Names.test.jello"), "app/Names");
});
