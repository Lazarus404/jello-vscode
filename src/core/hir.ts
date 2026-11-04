// Types from `jelloc --hir --spans`. Each node's line ends `: type @start..end`, with the module's
// path after it when the node is from a module other than the entry. The listing's format is not
// stable, so whatever this cannot read is left out rather than guessed at.

export interface TypedSpan {
  /** Byte offsets in the module's source. */
  start: number;
  end: number;
  type: string;
  /** What the node is, as the listing names it, such as `local %0` or `call @1`. */
  what: string;
}

const SPAN = /(?:^|[\s(,])([^\s:(,][^:(]*?): (.+?) @(\d+)\.\.(\d+)(?: ([^\s)]+))?(?=[\s),]|$)/g;

/**
 * The typed spans of the entry module, or of `file` when given: an imported module's spans carry
 * its path, and the entry's carry none.
 */
export function parseTypedSpans(listing: string, file?: string): TypedSpan[] {
  const out: TypedSpan[] = [];
  for (const line of listing.split(/\r?\n/)) {
    SPAN.lastIndex = 0;
    for (let m = SPAN.exec(line); m !== null; m = SPAN.exec(line)) {
      const path = m[5];
      if ((file === undefined) !== (path === undefined) || (path !== undefined && path !== file))
        continue;
      // A literal's text may hold `: `; a type never holds a quote.
      if (m[2].includes('"')) continue;
      out.push({
        what: m[1].trim(),
        type: surfaceType(m[2]),
        start: Number(m[3]),
        end: Number(m[4]),
      });
    }
  }
  return out;
}

/** The smallest span holding byte `offset`. */
export function typeAt(spans: TypedSpan[], offset: number): TypedSpan | undefined {
  let best: TypedSpan | undefined;
  for (const s of spans) {
    if (s.start > offset || s.end <= offset) continue;
    if (!best || s.end - s.start < best.end - best.start) best = s;
  }
  return best;
}

const NAMES: Record<string, string> = {
  bool: "Bool",
  bytes: "Bytes",
  dynamic: "Dynamic",
  null: "Null",
  atom: "Atom",
  object: "Object",
  array: "Array",
  list: "List",
  byte_buffer: "ByteBuffer",
  buffer: "ByteBuffer",
};

/** A type as the listing spells it (`array<i32>`), as a program would write it (`Array<I32>`). */
export function surfaceType(type: string): string {
  return type
    .replace(/\btuple<([^<>]*(?:<[^<>]*>[^<>]*)*)>/g, "($1)")
    .replace(/\b([iuf])(8|16|32|64)\b/g, (_, k: string, w: string) => k.toUpperCase() + w)
    .replace(/\b[a-z_]+\b/g, (word) => NAMES[word] ?? word);
}
