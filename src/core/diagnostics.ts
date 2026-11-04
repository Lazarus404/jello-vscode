// Reads jelloc's diagnostics: `path:line:col: [warning: |note: ]message [E0000]`, each followed
// by its source line and a caret, as docs/07-tooling/01-jelloc.md describes.

export type Severity = "error" | "warning" | "information";

/** A place in a file; line and column count from 1, the column in characters. */
export interface Place {
  file: string;
  line: number;
  column: number;
}

export interface Note extends Place {
  message: string;
}

export interface CompilerDiagnostic extends Place {
  severity: Severity;
  message: string;
  code?: string;
  notes: Note[];
}

export interface CompilerOutput {
  diagnostics: CompilerDiagnostic[];
  /** The text of an internal compiler error, which is a bug in jelloc, not in the program. */
  internal?: string;
  /** Set when the compiler gave up after its error limit. */
  stopped: boolean;
  /** Lines that are none of the above, such as `jelloc: cannot read x.jello`. */
  other: string[];
}

const HEADER = /^(?:(?:LEXER|PARSER)\t)?(.+?):(\d+):(\d+): (.*)$/;
const CODE = /^(.*?)\s*\[(E\d{4})\]$/;
const CARET = /^\s*\^\s*$/;

/** Parses everything jelloc wrote to standard error. */
export function parseCompilerOutput(text: string): CompilerOutput {
  const lines = text.split(/\r?\n/);
  const out: CompilerOutput = { diagnostics: [], stopped: false, other: [] };
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (/^stopped after \d+ errors$/.test(line)) {
      out.stopped = true;
      continue;
    }
    if (line.startsWith("internal error:")) {
      out.internal = lines.slice(i).join("\n").trim();
      break;
    }
    const header = HEADER.exec(line);
    if (!header || !/^\d/.test(header[2])) {
      out.other.push(line);
      continue;
    }

    // The source line and caret that follow a header are for people, not for us.
    if (i + 2 < lines.length && CARET.test(lines[i + 2])) i += 2;
    else if (i + 1 < lines.length && CARET.test(lines[i + 1])) i += 1;

    const place = { file: header[1], line: Number(header[2]), column: Number(header[3]) };
    let rest = header[4];
    if (rest.startsWith("note: ")) {
      const owner = out.diagnostics.at(-1);
      if (owner) owner.notes.push({ ...place, message: rest.slice(6) });
      continue;
    }
    let severity: Severity = "error";
    if (rest.startsWith("warning: ")) {
      severity = "warning";
      rest = rest.slice(9);
    }
    const coded = CODE.exec(rest);
    const diagnostic: CompilerDiagnostic = {
      ...place,
      severity,
      message: coded ? coded[1] : rest,
      code: coded ? coded[2] : undefined,
      notes: [],
    };
    // `--parse` labels a failure with its pass and the compiler reports it twice; once will do.
    const key = `${place.file}:${place.line}:${place.column}:${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.diagnostics.push(diagnostic);
  }
  return out;
}

export interface Trap extends Place {
  name: string;
  message: string;
  thrown?: string;
}

// `jello: `, or `jellovm: ` from an older Jello.
const TRAP = /^(.+?):(\d+):(\d+): jello(?:vm)?: trap (\w+)(.*)$/;
const THROWN = /^jello(?:vm)?: thrown: /;

/** Reads a runtime trap from what `jello` wrote to standard error, if there is one. */
export function parseTrap(text: string): Trap | undefined {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = TRAP.exec(lines[i]);
    if (!m) continue;
    const next = lines[i + 1] ?? "";
    const thrown = THROWN.test(next) ? next.replace(THROWN, "") : undefined;
    return {
      file: m[1],
      line: Number(m[2]),
      column: Number(m[3]),
      name: m[4],
      message: `trap ${m[4]}${m[5]}`,
      thrown,
    };
  }
  return undefined;
}
