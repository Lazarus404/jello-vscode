// What a module declares, imports and binds, read from its tokens: enough for an outline,
// completion, hover and go-to-definition, without the compiler. Nothing here type-checks.

import { Token, tokenize } from "./lexer";

export type DeclarationKind =
  | "function"
  | "value"
  | "constant"
  | "enum"
  | "variant"
  | "typedef"
  | "field"
  | "prototype"
  | "method"
  | "macro";

export interface Param {
  name: string;
  type?: string;
  /** The parameter as written, such as `?b: I32 = 1`. */
  text: string;
}

export interface Declaration {
  kind: DeclarationKind;
  name: string;
  exported: boolean;
  nameStart: number;
  nameEnd: number;
  /** The whole declaration, for the outline. */
  start: number;
  end: number;
  typeParams?: string;
  params?: Param[];
  result?: string;
  /** A binding's annotated type, or a typedef's aliased type. */
  type?: string;
  doc?: string;
  children: Declaration[];
}

export interface ImportedName {
  name: string;
  alias?: string;
  start: number;
  end: number;
}

export interface Import {
  kind: "named" | "type" | "namespace" | "load";
  module: string;
  moduleStart: number;
  moduleEnd: number;
  names: ImportedName[];
  /** For `import a.b as Alias;`. */
  alias?: string;
  aliasStart?: number;
  start: number;
  end: number;
}

export interface Local {
  name: string;
  kind: "local" | "param";
  type?: string;
  start: number;
  end: number;
  scopeStart: number;
  scopeEnd: number;
}

export interface Scan {
  package?: { path: string; start: number; end: number };
  imports: Import[];
  declarations: Declaration[];
  locals: Local[];
  atoms: string[];
}

/** Scans one module's source. */
export function scan(source: string): Scan {
  return new Scanner(source).run();
}

/** The names a function binding, a variant or a method takes, as `name(a: I32): Bytes`. */
export function signature(d: Declaration): string {
  const params = d.params?.map((p) => p.text).join(", ");
  switch (d.kind) {
    case "function":
    case "method":
    case "macro":
      return `${d.name}${d.typeParams ?? ""}(${params ?? ""})${d.result ? `: ${d.result}` : ""}`;
    case "variant":
      return d.params ? `${d.name}(${params})` : d.name;
    case "typedef":
      return `typedef ${d.name}${d.typeParams ?? ""}${d.type ? ` = ${d.type}` : ""}`;
    case "enum":
    case "prototype":
      return `${d.kind} ${d.name}${d.typeParams ?? ""}`;
    default:
      return `${d.name}${d.type ? `: ${d.type}` : ""}`;
  }
}

/** The text of a doc comment, without its markers. */
export function commentText(comments: string[]): string {
  return comments
    .map((c) => {
      if (c.startsWith("/*")) {
        return c
          .replace(/^\/\*\*?/, "")
          .replace(/\*\/$/, "")
          .split("\n")
          .map((line) => line.replace(/^\s*\*(?!\/) ?/, ""))
          .join("\n");
      }
      return c.replace(/^(\/\/+|#) ?/, "");
    })
    .join("\n")
    .trim();
}

class Scanner {
  private readonly all: Token[];
  private readonly t: Token[];
  /** For each code token index of an opening bracket, the index of its closing one. */
  private readonly close = new Map<number, number>();
  /** For each code token, its index among all tokens. */
  private readonly allIndex: number[] = [];
  /** For each code token, the index of the innermost `{` around it, or -1. */
  private readonly enclosing: number[] = [];
  private readonly result: Scan = { imports: [], declarations: [], locals: [], atoms: [] };

  constructor(private readonly source: string) {
    this.all = tokenize(source);
    this.t = [];
    this.all.forEach((x, k) => {
      if (x.kind === "comment" || x.kind === "doc") return;
      this.t.push(x);
      this.allIndex.push(k);
    });
    const stack: number[] = [];
    const braces: number[] = [];
    this.t.forEach((x, i) => {
      this.enclosing.push(braces.at(-1) ?? -1);
      if (x.kind !== "punct") return;
      if (x.text === "{" || x.text === "(" || x.text === "[") {
        stack.push(i);
        if (x.text === "{") braces.push(i);
      } else if (x.text === "}" || x.text === ")" || x.text === "]") {
        const open = stack.pop();
        if (open !== undefined) this.close.set(open, i);
        if (x.text === "}") braces.pop();
      }
    });
  }

  run(): Scan {
    const atoms = new Set<string>();
    let depth = 0;
    for (let i = 0; i < this.t.length; i++) {
      const x = this.t[i];
      if (x.kind === "atom") atoms.add(x.text.slice(1));
      if (x.kind === "punct" && x.text === "{") depth++;
      else if (x.kind === "punct" && x.text === "}") depth = Math.max(0, depth - 1);
      else if (x.kind === "keyword") {
        if (depth === 0) this.topLevel(i);
        this.local(i);
      }
    }
    this.result.atoms = [...atoms].sort();
    return this.result;
  }

  private is(i: number, text: string): boolean {
    return this.t[i]?.text === text && this.t[i].kind !== "string";
  }

  private ident(i: number): boolean {
    return this.t[i]?.kind === "ident";
  }

  private end(i: number): number {
    return this.close.get(i) ?? this.t.length - 1;
  }

  /** The source between tokens `from` and `to`, inclusive, or undefined if empty. */
  private text(from: number, to: number): string | undefined {
    if (from > to || from >= this.t.length) return undefined;
    return this.source
      .slice(this.t[from].start, this.t[Math.min(to, this.t.length - 1)].end)
      .replace(/\s+/g, " ")
      .trim();
  }

  /** The index after a `<…>` that starts at `i`, or `i` itself when none does. */
  private skipAngles(i: number): number {
    if (!this.is(i, "<")) return i;
    let depth = 0;
    for (let j = i; j < this.t.length; j++) {
      const s = this.t[j].text;
      if (s === "<") depth++;
      else if (s === ">") depth--;
      else if (s === ">>") depth -= 2;
      else if (s === ";" || s === "{" || s === "=") return i;
      if (depth <= 0) return j + 1;
    }
    return i;
  }

  /** The first index from `i` at depth 0 whose text is in `stops`, or the token count. */
  private until(i: number, stops: string[]): number {
    let depth = 0;
    for (let j = i; j < this.t.length; j++) {
      const s = this.t[j].kind === "punct" ? this.t[j].text : "";
      if (depth === 0 && stops.includes(this.t[j].text) && this.t[j].kind !== "string") return j;
      if (s === "(" || s === "[" || s === "{") depth++;
      else if (s === ")" || s === "]" || s === "}") {
        if (depth === 0) return j;
        depth--;
      }
    }
    return this.t.length;
  }

  /** The doc comment that ends just before the code token `i`. */
  private docBefore(i: number): string | undefined {
    const first = this.t[i];
    let k = this.allIndex[i] - 1;
    const comments: string[] = [];
    let next = first.start;
    while (k >= 0 && (this.all[k].kind === "comment" || this.all[k].kind === "doc")) {
      const gap = this.source.slice(this.all[k].end, next);
      if ((gap.match(/\n/g) ?? []).length > 1) break;
      comments.unshift(this.all[k].text);
      next = this.all[k].start;
      k--;
    }
    // A blank line ends the comment, so a file's header doesn't document its first declaration.
    return comments.length > 0 ? commentText(comments) : undefined;
  }

  /** The parameters between the parentheses at `open`. */
  private params(open: number): Param[] {
    const close = this.end(open);
    const out: Param[] = [];
    let j = open + 1;
    while (j < close) {
      const stop = Math.min(this.until(j, [","]), close);
      let k = j;
      while (k < stop && (this.is(k, "?") || this.is(k, "..."))) k++;
      if (this.ident(k) || this.t[k]?.kind === "keyword") {
        const colon = this.is(k + 1, ":") ? k + 1 : -1;
        const typeEnd = colon < 0 ? -1 : Math.min(this.until(colon + 1, ["=", ","]), stop) - 1;
        out.push({
          name: this.t[k].text,
          type: colon < 0 ? undefined : this.text(colon + 1, typeEnd),
          text: this.text(j, stop - 1) ?? this.t[k].text,
        });
      }
      j = stop + 1;
    }
    return out;
  }

  private declaration(
    kind: DeclarationKind,
    name: number,
    start: number,
    end: number,
    extra: Partial<Declaration>,
  ): Declaration {
    return {
      kind,
      name: this.t[name].text,
      exported: false,
      nameStart: this.t[name].start,
      nameEnd: this.t[name].end,
      start: this.t[start].start,
      end: this.t[Math.min(end, this.t.length - 1)].end,
      children: [],
      ...extra,
    };
  }

  private topLevel(i: number): void {
    const word = this.t[i].text;
    const exported = this.is(i - 1, "export");
    const start = exported ? i - 1 : i;
    let decl: Declaration | undefined;

    if (word === "package") {
      const stop = this.until(i + 1, [";"]);
      const path = this.text(i + 1, stop - 1);
      if (path) {
        this.result.package = {
          path: path.replace(/\s/g, ""),
          start: this.t[i + 1].start,
          end: this.t[stop - 1].end,
        };
      }
    } else if (word === "import" || word === "load") {
      this.importAt(i);
    } else if ((word === "let" || word === "const") && this.ident(i + 1)) {
      decl = this.binding(i, start);
    } else if (word === "enum" && this.ident(i + 1)) {
      decl = this.enumAt(i, start);
    } else if (word === "typedef" && this.ident(i + 1)) {
      decl = this.typedefAt(i, start);
    } else if (word === "prototype" && this.ident(i + 1)) {
      decl = this.prototypeAt(i, start);
    } else if (word === "macro" && this.ident(i + 1) && this.is(i + 2, "(")) {
      const close = this.end(i + 2);
      decl = this.declaration("macro", i + 1, start, this.end(close + 1), {
        params: this.params(i + 2),
      });
    }
    if (decl) {
      decl.exported = exported;
      decl.doc = this.docBefore(start);
      this.result.declarations.push(decl);
    }
  }

  private binding(i: number, start: number): Declaration {
    const name = i + 1;
    let j = this.skipAngles(name + 1);
    const typeParams = j > name + 1 ? this.text(name + 1, j - 1) : undefined;
    let type: string | undefined;
    if (this.is(j, ":")) {
      const eq = this.until(j + 1, ["=", ";"]);
      type = this.text(j + 1, eq - 1);
      j = eq;
    }
    const stop = this.until(j, [";"]);
    let fn = this.is(j, "=") ? j + 1 : -1;
    if (fn >= 0 && this.is(fn, "method")) fn++;
    if (fn >= 0 && this.is(fn, "fn")) {
      const open = this.skipAngles(fn + 1);
      if (this.is(open, "(")) {
        const close = this.end(open);
        const body = this.until(close + 1, ["{", ";"]);
        const result = this.is(close + 1, ":") ? this.text(close + 2, body - 1) : undefined;
        const params = this.params(open);
        this.paramLocals(params, open, body);
        return this.declaration("function", name, start, stop, {
          typeParams: typeParams ?? (open > fn + 1 ? this.text(fn + 1, open - 1) : undefined),
          params,
          result: result ?? functionResult(type),
        });
      }
    }
    const constant = this.t[i].text === "const";
    return this.declaration(constant ? "constant" : "value", name, start, stop, {
      type,
      typeParams,
    });
  }

  private enumAt(i: number, start: number): Declaration {
    const open = this.skipAngles(i + 2);
    const typeParams = open > i + 2 ? this.text(i + 2, open - 1) : undefined;
    const decl = this.declaration(
      "enum",
      i + 1,
      start,
      this.is(open, "{") ? this.end(open) : i + 1,
      { typeParams },
    );
    if (!this.is(open, "{")) return decl;
    const close = this.end(open);
    for (let j = open + 1; j < close; j = this.until(j, [";", ","]) + 1) {
      if (!this.ident(j)) continue;
      const params = this.is(j + 1, "(") ? this.params(j + 1) : undefined;
      const stop = Math.min(this.until(j, [";", ","]), close);
      const variant = this.declaration("variant", j, j, stop - 1, { params });
      variant.doc = this.docBefore(j);
      decl.children.push(variant);
    }
    return decl;
  }

  private typedefAt(i: number, start: number): Declaration {
    const eq = this.skipAngles(i + 2);
    const typeParams = eq > i + 2 ? this.text(i + 2, eq - 1) : undefined;
    const stop = this.until(eq, [";"]);
    const decl = this.declaration("typedef", i + 1, start, stop, { typeParams });
    let open = eq + 1;
    if (this.is(open, "bytes") && this.is(open + 1, "-")) open += 3;
    if (!this.is(eq, "=") || !this.is(open, "{")) {
      decl.type = this.is(eq, "=") ? this.text(eq + 1, stop - 1) : undefined;
      return decl;
    }
    decl.type = open > eq + 1 ? "bytes-layout { … }" : "{ … }";
    const close = this.end(open);
    for (let j = open + 1; j < close; j = this.until(j, [";"]) + 1) {
      if (!this.is(j, "let") || !this.ident(j + 1)) continue;
      const fieldEnd = Math.min(this.until(j, [";"]), close);
      const type = this.is(j + 2, ":") ? this.text(j + 3, fieldEnd - 1) : undefined;
      const field = this.declaration("field", j + 1, j, fieldEnd - 1, { type });
      field.doc = this.docBefore(j);
      decl.children.push(field);
    }
    return decl;
  }

  private prototypeAt(i: number, start: number): Declaration {
    const open = this.skipAngles(i + 2);
    const typeParams = open > i + 2 ? this.text(i + 2, open - 1) : undefined;
    if (!this.is(open, "{"))
      return this.declaration("prototype", i + 1, start, i + 1, { typeParams });
    const close = this.end(open);
    const decl = this.declaration("prototype", i + 1, start, close, { typeParams });
    for (let j = open + 1; j < close; j = this.until(j, [";"]) + 1) {
      if (!this.ident(j) && this.t[j]?.kind !== "keyword") continue;
      const memberEnd = Math.min(this.until(j, [";"]), close);
      let member: Declaration | undefined;
      if (this.is(j + 1, "(")) {
        const paren = this.end(j + 1);
        const body = this.until(paren + 1, ["{", ";"]);
        const params = this.params(j + 1);
        this.paramLocals(params, j + 1, body);
        member = this.declaration("method", j, j, memberEnd - 1, {
          params,
          result: this.is(paren + 1, ":") ? this.text(paren + 2, body - 1) : undefined,
        });
      } else if (this.is(j + 1, ":")) {
        member = this.declaration("field", j, j, memberEnd - 1, {});
      }
      if (member) {
        member.doc = this.docBefore(j);
        decl.children.push(member);
      }
    }
    return decl;
  }

  private importAt(i: number): void {
    const stop = this.until(i + 1, [";"]);
    let j = i + 1;
    let kind: Import["kind"] = this.t[i].text === "load" ? "load" : "named";
    if (this.is(j, "type")) {
      kind = "type";
      j++;
    }
    const names: ImportedName[] = [];
    if (this.is(j, "{")) {
      const close = Math.min(this.end(j), stop);
      for (let k = j + 1; k < close; k = this.until(k, [","]) + 1) {
        if (!this.ident(k) && this.t[k]?.kind !== "keyword") continue;
        const alias = this.is(k + 1, "as") && this.t[k + 2] ? this.t[k + 2].text : undefined;
        names.push({ name: this.t[k].text, alias, start: this.t[k].start, end: this.t[k].end });
      }
      j = close + 1;
      if (this.is(j, "from")) j++;
    } else if (kind === "named") {
      kind = "namespace";
    }
    let pathEnd = j;
    while (pathEnd < stop && !this.is(pathEnd, "as")) pathEnd++;
    const module = this.text(j, pathEnd - 1)?.replace(/\s/g, "");
    if (!module) return;
    const entry: Import = {
      kind,
      module,
      moduleStart: this.t[j].start,
      moduleEnd: this.t[pathEnd - 1].end,
      names,
      start: this.t[i].start,
      end: this.t[Math.min(stop, this.t.length - 1)].end,
    };
    if (this.is(pathEnd, "as") && this.ident(pathEnd + 1)) {
      entry.alias = this.t[pathEnd + 1].text;
      entry.aliasStart = this.t[pathEnd + 1].start;
    }
    this.result.imports.push(entry);
  }

  /** The innermost braces around token `i`, as source offsets. */
  private scopeOf(i: number): [number, number] {
    const open = this.enclosing[i];
    if (open < 0) return [0, this.source.length];
    return [this.t[open].start, this.t[this.end(open)].end];
  }

  /** Parameters, in scope in the body that starts at token `body`. */
  private paramLocals(params: Param[], open: number, body: number): void {
    if (!this.is(body, "{")) return;
    const scopeStart = this.t[body].start;
    const scopeEnd = this.t[this.end(body)].end;
    const close = this.end(open);
    for (const p of params) {
      const tok = this.t.slice(open, close).find((x) => x.text === p.name);
      if (!tok) continue;
      this.result.locals.push({
        name: p.name,
        kind: "param",
        type: p.type,
        start: tok.start,
        end: tok.end,
        scopeStart,
        scopeEnd,
      });
    }
  }

  /** Locals bound by `let`, `for` and `catch` inside blocks. */
  private local(i: number): void {
    const word = this.t[i].text;
    if (word === "let" && this.scopeOf(i)[0] > 0) {
      const scope = this.scopeOf(i);
      const end = this.until(i + 1, ["=", ";"]);
      const colon = this.ident(i + 1) && this.is(i + 2, ":") ? i + 2 : -1;
      const names = colon > 0 ? [i + 1] : this.patternNames(i + 1, end);
      for (const k of names) {
        this.result.locals.push({
          name: this.t[k].text,
          kind: "local",
          type: colon > 0 ? this.text(colon + 1, end - 1) : undefined,
          start: this.t[k].start,
          end: this.t[k].end,
          scopeStart: this.t[k].end,
          scopeEnd: scope[1],
        });
      }
    } else if ((word === "for" || word === "catch") && this.is(i + 1, "(")) {
      const close = this.end(i + 1);
      const inAt =
        word === "for"
          ? this.t.findIndex((x, k) => k > i + 1 && k < close && x.text === "in")
          : close;
      const body = close + 1;
      if (inAt < 0 || !this.is(body, "{")) return;
      for (const k of this.patternNames(i + 2, inAt)) {
        this.result.locals.push({
          name: this.t[k].text,
          kind: "local",
          start: this.t[k].start,
          end: this.t[k].end,
          scopeStart: this.t[body].start,
          scopeEnd: this.t[this.end(body)].end,
        });
      }
    }
  }

  /** The tokens a pattern from `from` to before `to` binds: names, not variants or fields. */
  private patternNames(from: number, to: number): number[] {
    const out: number[] = [];
    for (let k = from; k < to; k++) {
      const x = this.t[k];
      if (x.kind !== "ident" || x.text === "_" || /^[A-Z]/.test(x.text)) continue;
      if (this.is(k + 1, "(") || this.is(k + 1, ".") || this.is(k - 1, ".")) continue;
      if (this.is(k + 1, ":") && this.is(k - 1, "{")) continue;
      out.push(k);
    }
    return out;
  }
}

/** The result type of an annotated function type such as `(A) -> B`. */
function functionResult(type: string | undefined): string | undefined {
  const arrow = type?.lastIndexOf("->") ?? -1;
  return arrow >= 0 ? type!.slice(arrow + 2).trim() : undefined;
}
