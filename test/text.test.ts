import assert from "node:assert/strict";
import { test } from "node:test";
import { ByteOffsets, utf16Column } from "../src/core/text";

test("character columns become UTF-16 columns", () => {
  assert.equal(utf16Column("abc", 2), 2);
  assert.equal(utf16Column("é😀x", 2), 3);
  assert.equal(utf16Column("ab", 10), 2);
});

test("byte offsets and UTF-16 offsets map both ways", () => {
  const text = "aé😀b";
  const map = new ByteOffsets(text);
  // a=1 byte, é=2, 😀=4 (two UTF-16 units), b=1
  assert.equal(map.toUtf16(0), 0);
  assert.equal(map.toUtf16(1), 1);
  assert.equal(map.toUtf16(3), 2);
  assert.equal(map.toUtf16(7), 4);
  assert.equal(map.toByte(4), 7);
  assert.equal(map.toByte(5), 8);
});
