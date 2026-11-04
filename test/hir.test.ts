import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseTypedSpans, surfaceType, typeAt } from "../src/core/hir";
import { ByteOffsets } from "../src/core/text";
import { jelloc, needsJelloc, std } from "./support";

const LISTING = `program
  fn @1 sq(%0 n: i32 @32..38 /w/geo/M.jello) -> i32 @29..54 /w/geo/M.jello
    tail
      mul.wrap: i32 @47..52 /w/geo/M.jello
  global g0 x: i32 @26..40
    call @1: i32 @34..39
      i32 3: i32 @37..38
  global g1 t: tuple<i32, bytes, atom, f64, u8, list<i32>> @41..80
    bytes "a: b": bytes @50..56
  global g6 g: (i32) -> bytes @81..90
`;

test("the entry's spans have no path; another module's carry its own", () => {
  const entry = parseTypedSpans(LISTING);
  assert.deepEqual(
    entry.map((s) => s.type),
    ["I32", "I32", "I32", "(I32, Bytes, Atom, F64, U8, List<I32>)", "(I32) -> Bytes"],
  );
  const other = parseTypedSpans(LISTING, "/w/geo/M.jello");
  assert.deepEqual(
    other.map((s) => [s.what, s.type]),
    [
      ["%0 n", "I32"],
      ["mul.wrap", "I32"],
    ],
  );
  assert.equal(typeAt(entry, 37)?.what, "i32 3");
  assert.equal(typeAt(entry, 30)?.what, "global g0 x");
  assert.equal(typeAt(entry, 500), undefined);
});

test("types read as a program writes them", () => {
  assert.equal(surfaceType("?i32"), "?I32");
  assert.equal(surfaceType("array<array<bytes>>"), "Array<Array<Bytes>>");
  assert.equal(surfaceType("object"), "Object");
  assert.equal(surfaceType("Shape"), "Shape");
});

test("the real compiler's listing still reads", needsJelloc, () => {
  const dir = mkdtempSync(join(tmpdir(), "jello-hir-"));
  const file = join(dir, "main.jello");
  const source =
    'let add = fn(a: I32, b: I32): I32 { a + b };\nlet word = "é";\nlet xs = [add(1, 2)];\nStd.string(xs)\n';
  writeFileSync(file, source);
  const listing = execFileSync(jelloc!, [file, "--std", std, "--hir", "--spans"], {
    encoding: "utf8",
  });
  const spans = parseTypedSpans(listing);
  const bytes = new ByteOffsets(source);
  const at = (needle: string) => typeAt(spans, bytes.toByte(source.indexOf(needle)))?.type;
  assert.equal(at("xs ="), "Array<I32>");
  assert.equal(at("add(1"), "I32");
  assert.equal(at("1, 2)]"), "I32");
  assert.equal(at('"é"'), "Bytes");
});
