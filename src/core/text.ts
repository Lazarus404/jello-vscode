// Offsets the compiler reports, turned into the UTF-16 offsets an editor counts in.

/** The UTF-16 index in `text` of the character at code-point column `column` (0-based). */
export function utf16Column(text: string, column: number): number {
  let index = 0;
  for (let seen = 0; seen < column && index < text.length; seen++) {
    const code = text.charCodeAt(index);
    index += code >= 0xd800 && code <= 0xdbff && index + 1 < text.length ? 2 : 1;
  }
  return index;
}

/**
 * Maps UTF-8 byte offsets in `text` to UTF-16 offsets. The table is built once per text; a
 * listing's spans are byte ranges, and a buffer's offsets are not.
 */
export class ByteOffsets {
  private readonly starts: number[] = [];

  constructor(private readonly text: string) {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
      this.starts.push(bytes);
      const code = text.charCodeAt(i);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff) {
        bytes += 4;
        this.starts.push(bytes);
        i++;
      } else bytes += 3;
    }
    this.starts.push(bytes);
  }

  /** The UTF-16 offset of byte `byte`, or of the character holding it. */
  toUtf16(byte: number): number {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.starts[mid] <= byte) low = mid;
      else high = mid - 1;
    }
    return Math.min(low, this.text.length);
  }

  /** The UTF-8 byte offset of UTF-16 offset `index`. */
  toByte(index: number): number {
    return this.starts[Math.max(0, Math.min(index, this.starts.length - 1))];
  }
}
