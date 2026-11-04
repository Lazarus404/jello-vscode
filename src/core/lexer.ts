// A small tokenizer that follows the compiler's lexical rules (docs/01-lexical.md) closely enough
// to find declarations: it never mistakes a brace in a string, template or regexp for code.

export const KEYWORDS = new Set([
  "as",
  "await",
  "bits",
  "break",
  "catch",
  "const",
  "continue",
  "do",
  "else",
  "enum",
  "export",
  "false",
  "fn",
  "for",
  "from",
  "if",
  "import",
  "is",
  "let",
  "list",
  "load",
  "macro",
  "match",
  "new",
  "null",
  "package",
  "prototype",
  "return",
  "super",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typedef",
  "when",
  "while",
  "with",
]);

export type TokenKind =
  | "ident"
  | "keyword"
  | "number"
  | "string"
  | "template"
  | "regexp"
  | "atom"
  | "punct"
  | "comment"
  | "doc";

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
}

const OPERATORS = [
  "<<=",
  ">>=",
  "...",
  "??",
  "|>",
  "->",
  "=>",
  "<-",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "<<",
  ">>",
];

const isWordStart = (c: string) => /[A-Za-z_]/.test(c);
const isWord = (c: string) => /[A-Za-z0-9_]/.test(c);

/** The tokens of `source`, comments included. Malformed text never throws; it just ends. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;
  const push = (kind: TokenKind, start: number, end: number) =>
    tokens.push({ kind, text: source.slice(start, end), start, end });

  /** The end of a quoted literal that started at `start`, stopping at the line's end. */
  const quoted = (start: number, quote: string): number => {
    let j = start + 1;
    while (j < n && source[j] !== quote && source[j] !== "\n") j += source[j] === "\\" ? 2 : 1;
    return j < n && source[j] === quote ? j + 1 : j;
  };

  /** The end of a template that started at `start`; holes may hold braces and templates. */
  const template = (start: number): number => {
    let j = start + 1;
    while (j < n && source[j] !== "`") {
      if (source[j] === "\\") {
        j += 2;
        continue;
      }
      if (source[j] === "$" && source[j + 1] === "{") {
        j = hole(j + 2);
        continue;
      }
      j++;
    }
    return Math.min(j + 1, n);
  };

  /** The end of a template hole whose `${` ended just before `start`. */
  const hole = (start: number): number => {
    let depth = 1;
    let j = start;
    while (j < n && depth > 0) {
      const c = source[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      if (c === '"' || c === "'") {
        j = quoted(j, c);
        continue;
      }
      if (c === "`") {
        j = template(j);
        continue;
      }
      j++;
    }
    return j;
  };

  while (i < n) {
    const c = source[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const start = i;

    if (c === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") i++;
      push("comment", start, i);
    } else if (c === "#") {
      while (i < n && source[i] !== "\n") i++;
      push("comment", start, i);
    } else if (c === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      i = close < 0 ? n : close + 2;
      const doc = source.startsWith("/**", start) && !source.startsWith("/**/", start);
      push(doc ? "doc" : "comment", start, i);
    } else if (c === '"' || c === "'") {
      i = quoted(i, c);
      push("string", start, i);
    } else if (c === "`") {
      i = template(i);
      push("template", start, i);
    } else if (c === "~" && source[i + 1] === "r" && source[i + 2] === "/") {
      i = quoted(i + 2, "/");
      while (i < n && /[imsxU]/.test(source[i])) i++;
      push("regexp", start, i);
    } else if (c === ":" && isWordStart(source[i + 1] ?? "") && !atomBlocked(source, i)) {
      i++;
      while (i < n && isWord(source[i])) i++;
      push("atom", start, i);
    } else if (
      /[0-9]/.test(c) ||
      (c === "." &&
        /[0-9]/.test(source[i + 1] ?? "") &&
        tokens.at(-1)?.kind !== "ident" &&
        tokens.at(-1)?.text !== ")")
    ) {
      const member = tokens.at(-1)?.text === ".";
      i++;
      while (i < n && isWord(source[i])) i++;
      if (!member && source[i] === "." && /[0-9]/.test(source[i + 1] ?? "")) {
        i++;
        while (i < n && isWord(source[i])) i++;
      }
      push("number", start, i);
    } else if (isWordStart(c)) {
      while (i < n && isWord(source[i])) i++;
      const word = source.slice(start, i);
      const afterDot = tokens.at(-1)?.text === ".";
      push(KEYWORDS.has(word) && !afterDot ? "keyword" : "ident", start, i);
    } else {
      const op = OPERATORS.find((o) => source.startsWith(o, i));
      i += op ? op.length : 1;
      push("punct", start, i);
    }
  }
  return tokens;
}

/** Whether the `:` at `i` follows something that makes it a separator, not an atom's start. */
function atomBlocked(source: string, i: number): boolean {
  const before = source[i - 1] ?? "";
  return (
    isWord(before) ||
    before === ")" ||
    before === "]" ||
    before === '"' ||
    before === "'" ||
    before === "`"
  );
}

/** The tokens that are code, comments left out. */
export const code = (tokens: Token[]) =>
  tokens.filter((t) => t.kind !== "comment" && t.kind !== "doc");
