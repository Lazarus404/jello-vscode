// Completion, hover, signature help, definitions, symbols, links, highlights and folding, from
// the scanner's view of each module and, where the compiler has said, its types.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import builtinData from "../data/builtins.json";
import { KEYWORDS, tokenize } from "./core/lexer";
import { resolveModule } from "./core/modules";
import { Declaration, Local, Param, Scan, signature } from "./core/scan";
import { HoverTypes } from "./hoverTypes";
import { ModuleIndex } from "./moduleIndex";
import { Toolchain } from "./toolchain";
import { JelloWorkspace } from "./workspace";

interface Builtin {
  namespace: string;
  name: string;
  signature: string;
  description: string;
  method: boolean;
  overloads?: string[];
}

interface Note {
  text: string;
  page: string;
}

const data = builtinData as unknown as {
  keywords: Record<string, Note>;
  contextual: Record<string, Note>;
  types: Record<string, Note>;
  namespaces: string[];
  functions: Builtin[];
};

/** The namespaces whose std.core module adds methods. */
const EXTENDED = ["Array", "Bytes", "List", "Object"];
const IDENT = /[_A-Za-z][_A-Za-z0-9]*/;

const KIND: Record<Declaration["kind"], vscode.SymbolKind> = {
  function: vscode.SymbolKind.Function,
  value: vscode.SymbolKind.Variable,
  constant: vscode.SymbolKind.Constant,
  enum: vscode.SymbolKind.Enum,
  variant: vscode.SymbolKind.EnumMember,
  typedef: vscode.SymbolKind.Struct,
  field: vscode.SymbolKind.Field,
  prototype: vscode.SymbolKind.Class,
  method: vscode.SymbolKind.Method,
  macro: vscode.SymbolKind.Function,
};

const COMPLETION: Record<Declaration["kind"], vscode.CompletionItemKind> = {
  function: vscode.CompletionItemKind.Function,
  value: vscode.CompletionItemKind.Variable,
  constant: vscode.CompletionItemKind.Constant,
  enum: vscode.CompletionItemKind.Enum,
  variant: vscode.CompletionItemKind.EnumMember,
  typedef: vscode.CompletionItemKind.Struct,
  field: vscode.CompletionItemKind.Field,
  prototype: vscode.CompletionItemKind.Class,
  method: vscode.CompletionItemKind.Method,
  macro: vscode.CompletionItemKind.Function,
};

/** A name resolved to where it is declared. */
interface Found {
  declaration?: Declaration;
  local?: Local;
  file: string;
  /** The module it came from, for an imported name. */
  module?: string;
}

export class JelloLanguage {
  constructor(
    private readonly index: ModuleIndex,
    private readonly workspace: JelloWorkspace,
    private readonly toolchain: Toolchain,
    private readonly types: HoverTypes,
  ) {}

  register(): vscode.Disposable[] {
    const selector: vscode.DocumentSelector = { language: "jello" };
    return [
      vscode.languages.registerCompletionItemProvider(
        selector,
        {
          provideCompletionItems: (d, p) => this.complete(d, p),
        },
        ".",
        ":",
        " ",
        "{",
        ",",
      ),
      vscode.languages.registerHoverProvider(selector, {
        provideHover: (d, p) => this.hover(d, p),
      }),
      vscode.languages.registerSignatureHelpProvider(
        selector,
        {
          provideSignatureHelp: (d, p) => this.signatureHelp(d, p),
        },
        "(",
        ",",
      ),
      vscode.languages.registerDefinitionProvider(selector, {
        provideDefinition: (d, p) => this.definition(d, p),
      }),
      vscode.languages.registerDocumentSymbolProvider(
        selector,
        {
          provideDocumentSymbols: (d) => this.symbols(d),
        },
        { label: "Jello" },
      ),
      vscode.languages.registerWorkspaceSymbolProvider({
        provideWorkspaceSymbols: (q, t) => this.workspaceSymbols(q, t),
      }),
      vscode.languages.registerDocumentLinkProvider(selector, {
        provideDocumentLinks: (d) => this.links(d),
      }),
      vscode.languages.registerDocumentHighlightProvider(selector, {
        provideDocumentHighlights: (d, p) => this.highlights(d, p),
      }),
      vscode.languages.registerFoldingRangeProvider(selector, {
        provideFoldingRanges: (d) => this.folding(d),
      }),
    ];
  }

  // ---- Resolution -------------------------------------------------------------------------

  private scanOf(document: vscode.TextDocument): Scan {
    return this.index.ofDocument(document);
  }

  /** The import alias `alias` names, as in `import std.testing as T;`. */
  private aliasModule(scan: Scan, alias: string): string | undefined {
    return scan.imports.find((i) => i.kind === "namespace" && i.alias === alias)?.module;
  }

  /** The locals in scope at `offset`, nearest last. */
  private localsAt(scan: Scan, offset: number): Local[] {
    return scan.locals.filter(
      (l) =>
        l.scopeStart <= offset && offset <= l.scopeEnd && (l.kind === "param" || l.start < offset),
    );
  }

  /** Where `name`, used at `offset` in `document`, is declared. */
  private resolveName(
    document: vscode.TextDocument,
    name: string,
    offset: number,
  ): Found | undefined {
    const scan = this.scanOf(document);
    const file = document.uri.fsPath;
    const locals = this.localsAt(scan, offset).filter((l) => l.name === name);
    if (locals.length > 0) {
      // The innermost scope wins; within one scope, the latest binding.
      const local = locals.reduce((a, b) =>
        b.scopeStart > a.scopeStart || (b.scopeStart === a.scopeStart && b.start > a.start) ? b : a,
      );
      return { local, file };
    }
    const declaration = scan.declarations.find((d) => d.name === name);
    if (declaration) return { declaration, file };
    for (const i of scan.imports) {
      const imported = i.names.find((n) => (n.alias ?? n.name) === name);
      if (!imported) continue;
      const found = this.index.exportsOf(i.module, this.workspace.roots(file));
      const d = found?.declarations.find((x) => x.name === imported.name);
      if (found && d) return { declaration: d, file: found.file, module: i.module };
      return { file, module: i.module };
    }
    return undefined;
  }

  /** The members `Receiver.` offers when the receiver names a type, module or enum. */
  private staticMembers(
    document: vscode.TextDocument,
    receiver: string,
    offset: number,
  ):
    | {
        kind: "namespace" | "module" | "enum";
        builtins: Builtin[];
        declarations: Declaration[];
        file?: string;
      }
    | undefined {
    const scan = this.scanOf(document);
    const file = document.uri.fsPath;
    const module = this.aliasModule(scan, receiver);
    if (module) {
      const found = this.index.exportsOf(module, this.workspace.roots(file));
      return {
        kind: "module",
        builtins: [],
        declarations: found?.declarations ?? [],
        file: found?.file,
      };
    }
    const found = this.resolveName(document, receiver, offset);
    if (found?.declaration?.kind === "enum") {
      return {
        kind: "enum",
        builtins: [],
        declarations: found.declaration.children,
        file: found.file,
      };
    }
    if (!found && data.namespaces.includes(receiver)) {
      const extension = EXTENDED.includes(receiver)
        ? this.index.exportsOf(`std.core.${receiver}`, this.workspace.roots(file))
        : undefined;
      const builtins = data.functions.filter((f) => f.namespace === receiver);
      const names = new Set(builtins.map((b) => b.name));
      return {
        kind: "namespace",
        builtins,
        // An intrinsic wins over an extension function of the same name.
        declarations: (extension?.declarations ?? []).filter((d) => !names.has(d.name)),
        file: extension?.file,
      };
    }
    return undefined;
  }

  /** The type of `name` at `offset`, as annotated, or as the compiler last inferred it. */
  private typeOf(document: vscode.TextDocument, name: string, offset: number): string | undefined {
    const found = this.resolveName(document, name, offset);
    if (found?.local?.type) return found.local.type;
    if (found?.declaration?.type && found.declaration.kind !== "typedef")
      return found.declaration.type;
    if (found?.declaration?.kind === "prototype") return found.declaration.name;
    const at =
      found?.local?.start ??
      (found?.file === document.uri.fsPath ? found?.declaration?.nameStart : undefined);
    return at === undefined ? undefined : this.types.typeAt(document, at)?.type;
  }

  /** The methods and fields a value of `type` offers. */
  private membersOfType(
    document: vscode.TextDocument,
    type: string | undefined,
  ): { builtins: Builtin[]; declarations: Declaration[]; methodsOf: string[] } {
    const head = (type ?? "").replace(/^\?/, "").trim();
    let space: string | undefined;
    if (/^Array\b/.test(head)) space = "Array";
    else if (/^(Bytes|ByteBuffer)\b/.test(head)) space = "Bytes";
    else if (/^List\b/.test(head)) space = "List";
    else if (/^Object\b/.test(head)) space = "Object";
    else if (/^\(/.test(head)) space = "Tuple";
    else if (/^Atom\b/.test(head)) space = "Atom";
    if (space) return this.methodsOf(document, [space]);

    const named = IDENT.exec(head)?.[0];
    if (named) {
      const found = this.resolveName(document, named, 0);
      const d = found?.declaration;
      if (d?.kind === "enum") return this.methodsOf(document, ["Enum"]);
      if (d?.kind === "typedef" || d?.kind === "prototype") {
        // A linked typedef and prototype share a name: the fields of one, the methods of the other.
        const scan =
          found!.file === document.uri.fsPath
            ? this.scanOf(document)
            : this.index.ofFile(found!.file);
        const both = scan?.declarations.filter(
          (x) => x.name === named && (x.kind === "typedef" || x.kind === "prototype"),
        ) ?? [d];
        return { builtins: [], declarations: both.flatMap((x) => x.children), methodsOf: [named] };
      }
    }
    // Nothing known: every method a built-in value has.
    return this.methodsOf(document, ["Array", "Bytes", "List", "Object"]);
  }

  private methodsOf(
    document: vscode.TextDocument,
    spaces: string[],
  ): { builtins: Builtin[]; declarations: Declaration[]; methodsOf: string[] } {
    const roots = this.workspace.roots(document.uri.fsPath);
    const builtins = data.functions.filter((f) => f.method && spaces.includes(f.namespace));
    const declarations = spaces
      .filter((s) => EXTENDED.includes(s))
      .flatMap((s) => {
        const names = new Set(builtins.filter((b) => b.namespace === s).map((b) => b.name));
        return (this.index.exportsOf(`std.core.${s}`, roots)?.declarations ?? []).filter(
          (d) => d.kind === "function" && !names.has(d.name),
        );
      });
    return { builtins, declarations, methodsOf: spaces };
  }

  /** The prototype whose body holds `offset`, for `this.`. */
  private enclosingPrototype(scan: Scan, offset: number): Declaration | undefined {
    return scan.declarations.find(
      (d) => d.kind === "prototype" && d.start <= offset && offset <= d.end,
    );
  }

  // ---- Completion ---------------------------------------------------------------------------

  private complete(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | undefined {
    const line = document.lineAt(position.line).text;
    const before = line.slice(0, position.character);
    const after = line.slice(position.character);
    const offset = document.offsetAt(position);
    if (this.inCommentOrString(document, offset)) return undefined;
    const file = document.uri.fsPath;
    const scan = this.scanOf(document);

    // Module paths after `from`, `import` and `package`.
    const path =
      /^\s*(?:(?:export\s+)?import\s+(?:type\s+)?(?:\{[^}]*\}\s*from\s+)?|load\s*\{[^}]*\}\s*from\s+|package\s+|.*\bfrom\s+)([\w.]*)$/.exec(
        before,
      );
    if (path && !/\{[^}]*$/.test(before)) return this.completeModules(file, path[1], position);

    // Names inside `import { … } from m`.
    const braces = /^\s*(?:import\s+(?:type\s+)?|load\s*)\{[^}]*$/.exec(before);
    if (braces) {
      const module = /\}\s*from\s+([\w.]+)/.exec(after)?.[1];
      if (!module) return [];
      const found = this.index.exportsOf(module, this.workspace.roots(file));
      return (found?.declarations ?? []).map((d) => this.declarationItem(d));
    }

    // Members after a dot.
    const member = /([_A-Za-z][_A-Za-z0-9]*|\)|\])\s*\.\s*([_A-Za-z0-9]*)$/.exec(before);
    if (member) return this.completeMembers(document, member[1], offset - member[0].length);

    // Atoms.
    const atom = /(?:^|[\s(,[{=!?|&])(:)([_A-Za-z0-9]*)$/.exec(before);
    if (atom) {
      return scan.atoms.map((a) => {
        const item = new vscode.CompletionItem(a, vscode.CompletionItemKind.EnumMember);
        item.detail = `:${a}`;
        return item;
      });
    }

    // Type positions.
    if (
      /(?::\s*\??|->\s*\??|\b(?:as|is)\s+\??|<\s*|,\s*(?=[^()]*>))[_A-Za-z0-9]*$/.test(before) &&
      !/\bdo\s*:\s*\w*$/.test(before)
    ) {
      return this.completeTypes(scan);
    }
    return this.completeNames(scan, offset);
  }

  /** Whether `offset` is inside a comment or a literal, where code completion has no place. */
  private inCommentOrString(document: vscode.TextDocument, offset: number): boolean {
    // Only the text before the cursor is tokenised, so the last token ends at the cursor when the
    // cursor is in it or just after it.
    const last = tokenize(document.getText().slice(0, offset)).at(-1);
    if (!last || last.end < offset) return false;
    const closedBy = (end: string) => last.text.length >= 2 && last.text.endsWith(end);
    switch (last.kind) {
      case "comment":
        return !(last.text.startsWith("/*") && closedBy("*/") && last.text.length >= 4);
      case "doc":
        return !closedBy("*/");
      case "string":
        return !closedBy(last.text[0]);
      case "regexp":
        return !/\/[imsxU]*$/.test(last.text.slice(3));
      case "template": {
        if (closedBy("`")) return false;
        // Inside an open hole, a template holds code.
        const open = last.text.lastIndexOf("${");
        return !(open >= 0 && last.text.indexOf("}", open) < 0);
      }
      default:
        return false;
    }
  }

  private completeModules(
    file: string,
    typed: string,
    position: vscode.Position,
  ): vscode.CompletionItem[] {
    const roots = this.workspace.roots(file);
    const prefix = typed.includes(".") ? typed.slice(0, typed.lastIndexOf(".") + 1) : "";
    const range = new vscode.Range(
      position.translate(0, -(typed.length - prefix.length)),
      position,
    );
    const seen = new Map<string, vscode.CompletionItem>();
    for (const module of this.index.moduleList(roots)) {
      if (!module.startsWith(prefix)) continue;
      const rest = module.slice(prefix.length);
      const segment = rest.split(".")[0];
      const leaf = !rest.includes(".");
      const key = segment + (leaf ? "" : ".");
      if (seen.has(key)) continue;
      const item = new vscode.CompletionItem(
        segment,
        leaf ? vscode.CompletionItemKind.Module : vscode.CompletionItemKind.Folder,
      );
      item.range = range;
      item.detail = leaf ? module : prefix + segment + ".…";
      if (!leaf) item.command = { command: "editor.action.triggerSuggest", title: "more" };
      if (!leaf) item.insertText = segment + ".";
      seen.set(key, item);
    }
    return [...seen.values()];
  }

  private completeMembers(
    document: vscode.TextDocument,
    receiver: string,
    offset: number,
  ): vscode.CompletionItem[] {
    const scan = this.scanOf(document);
    if (receiver === "this") {
      const proto = this.enclosingPrototype(scan, offset);
      const linked = scan.declarations.filter((d) => d.name === proto?.name);
      return linked.flatMap((d) => d.children).map((d) => this.declarationItem(d));
    }
    const statics = /^[_A-Za-z]/.test(receiver)
      ? this.staticMembers(document, receiver, offset)
      : undefined;
    if (statics) {
      return [
        ...statics.builtins.map((b) => this.builtinItem(b, false)),
        ...statics.declarations.map((d) => this.declarationItem(d)),
      ];
    }
    const type = /^[_A-Za-z]/.test(receiver) ? this.typeOf(document, receiver, offset) : undefined;
    const members = this.membersOfType(document, type);
    return [
      ...members.builtins.map((b) => this.builtinItem(b, true)),
      ...members.declarations.map((d) => this.declarationItem(d, d.kind === "function")),
    ];
  }

  private completeTypes(scan: Scan): vscode.CompletionItem[] {
    const items = Object.entries(data.types).map(([name, note]) => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.TypeParameter);
      item.documentation = new vscode.MarkdownString(note.text);
      return item;
    });
    for (const d of scan.declarations) {
      if (d.kind === "typedef" || d.kind === "enum" || d.kind === "prototype")
        items.push(this.declarationItem(d));
    }
    for (const i of scan.imports) {
      for (const n of i.names) {
        const name = n.alias ?? n.name;
        if (/^[A-Z]/.test(name))
          items.push(new vscode.CompletionItem(name, vscode.CompletionItemKind.Class));
      }
    }
    return items;
  }

  private completeNames(scan: Scan, offset: number): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const seen = new Set<string>();
    const add = (item: vscode.CompletionItem) => {
      const label = typeof item.label === "string" ? item.label : item.label.label;
      if (seen.has(label)) return;
      seen.add(label);
      items.push(item);
    };
    for (const local of this.localsAt(scan, offset).reverse()) {
      const item = new vscode.CompletionItem(local.name, vscode.CompletionItemKind.Variable);
      item.detail = local.type ? `${local.name}: ${local.type}` : local.kind;
      item.sortText = "0";
      add(item);
    }
    for (const d of scan.declarations) {
      const item = this.declarationItem(d);
      item.sortText = "1";
      add(item);
    }
    for (const i of scan.imports) {
      if (i.alias) {
        const item = new vscode.CompletionItem(i.alias, vscode.CompletionItemKind.Module);
        item.detail = i.module;
        add(item);
      }
      for (const n of i.names) {
        const item = new vscode.CompletionItem(
          n.alias ?? n.name,
          vscode.CompletionItemKind.Reference,
        );
        item.detail = `from ${i.module}`;
        item.sortText = "1";
        add(item);
      }
    }
    for (const space of data.namespaces) {
      const item = new vscode.CompletionItem(space, vscode.CompletionItemKind.Module);
      item.detail = "built-in namespace";
      item.sortText = "2";
      add(item);
    }
    for (const [name, note] of Object.entries(data.types)) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.TypeParameter);
      item.documentation = new vscode.MarkdownString(note.text);
      item.sortText = "3";
      add(item);
    }
    for (const word of KEYWORDS) {
      const item = new vscode.CompletionItem(word, vscode.CompletionItemKind.Keyword);
      item.documentation = this.noteMarkdown(data.keywords[word]);
      item.sortText = "4";
      add(item);
    }
    return items;
  }

  private builtinItem(b: Builtin, asMethod: boolean): vscode.CompletionItem {
    const item = new vscode.CompletionItem(b.name, vscode.CompletionItemKind.Function);
    item.detail = asMethod ? `${b.namespace} method` : b.signature;
    item.documentation = new vscode.MarkdownString()
      .appendCodeblock(b.signature, "jello")
      .appendMarkdown(b.description);
    item.insertText = new vscode.SnippetString(`${b.name}($0)`);
    item.command = { command: "editor.action.triggerParameterHints", title: "parameters" };
    return item;
  }

  private declarationItem(d: Declaration, asMethod = false): vscode.CompletionItem {
    const item = new vscode.CompletionItem(
      d.name,
      asMethod ? vscode.CompletionItemKind.Method : COMPLETION[d.kind],
    );
    item.detail = asMethod ? methodSignature(d) : signature(d);
    if (d.doc) item.documentation = new vscode.MarkdownString(docMarkdown(d.doc));
    if (
      d.kind === "function" ||
      d.kind === "method" ||
      d.kind === "macro" ||
      (d.kind === "variant" && d.params)
    ) {
      item.insertText = new vscode.SnippetString(`${d.name}($0)`);
      item.command = { command: "editor.action.triggerParameterHints", title: "parameters" };
    }
    return item;
  }

  // ---- Hover --------------------------------------------------------------------------------

  private hover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(
      position,
      /[_A-Za-z][_A-Za-z0-9]*(?:\.[_A-Za-z][_A-Za-z0-9]*)*/,
    );
    if (!range) return undefined;
    const offset = document.offsetAt(position);
    if (this.inCommentOrString(document, offset)) return undefined;
    const scan = this.scanOf(document);
    const file = document.uri.fsPath;

    // A module path in an import or package line.
    const lineText = document.lineAt(position.line).text;
    const path = document.getText(range);
    if (/^\s*(?:import|load|package|export\s+import)\b/.test(lineText) && path.includes(".")) {
      const target = resolveModule(path, this.workspace.roots(file));
      if (target) {
        const md = new vscode.MarkdownString(`**module** \`${path}\``);
        md.appendMarkdown(`\n\n${vscode.workspace.asRelativePath(target)}`);
        return new vscode.Hover(md, range);
      }
    }

    // From here on, the one word under the cursor.
    const wordRange = document.getWordRangeAtPosition(position, IDENT)!;
    const word = document.getText(wordRange);
    const before = document.getText(
      new vscode.Range(new vscode.Position(position.line, 0), wordRange.start),
    );
    const receiver = /([_A-Za-z][_A-Za-z0-9]*)\s*\.\s*$/.exec(before)?.[1];
    const md = new vscode.MarkdownString();

    if (receiver) {
      const statics = this.staticMembers(document, receiver, offset);
      const b = statics?.builtins.find((x) => x.name === word);
      const d = statics?.declarations.find((x) => x.name === word);
      if (b) return new vscode.Hover(this.builtinMarkdown(b), wordRange);
      if (d) return new vscode.Hover(this.declarationMarkdown(d), wordRange);
      if (!statics) {
        const members =
          receiver === "this"
            ? {
                builtins: [],
                declarations: scan.declarations
                  .filter((x) => x.name === this.enclosingPrototype(scan, offset)?.name)
                  .flatMap((x) => x.children),
              }
            : this.membersOfType(document, this.typeOf(document, receiver, offset));
        const mb = members.builtins.find((x) => x.name === word);
        const md2 = members.declarations.find((x) => x.name === word);
        if (mb) return new vscode.Hover(this.builtinMarkdown(mb), wordRange);
        if (md2)
          return new vscode.Hover(
            this.declarationMarkdown(md2, md2.kind === "function"),
            wordRange,
          );
      }
      const inferred = this.types.typeAt(document, offset);
      if (inferred) return new vscode.Hover(typeMarkdown(word, inferred.type), wordRange);
      return undefined;
    }

    const keyword = KEYWORDS.has(word) ? data.keywords[word] : data.contextual[word];
    if (keyword && (KEYWORDS.has(word) || this.contextual(word, document, wordRange))) {
      md.appendMarkdown(`**${word}** — `).appendMarkdown(keyword.text);
      this.appendPage(md, keyword.page);
      return new vscode.Hover(md, wordRange);
    }

    const found = this.resolveName(document, word, offset);
    const inferred = this.types.typeAt(document, offset);
    if (found?.local) {
      const type = found.local.type ?? inferred?.type;
      const what = found.local.kind === "param" ? "parameter" : "local";
      md.appendCodeblock(`(${what}) ${word}${type ? `: ${type}` : ""}`, "jello");
      return new vscode.Hover(md, wordRange);
    }
    if (found?.declaration) {
      const hover = this.declarationMarkdown(found.declaration);
      if (found.module) hover.appendMarkdown(`\n\n*from* \`${found.module}\``);
      if (inferred && !found.declaration.type && found.declaration.kind === "value") {
        hover.appendMarkdown(`\n\n*type* \`${inferred.type}\``);
      }
      return new vscode.Hover(hover, wordRange);
    }
    if (found?.module) {
      return new vscode.Hover(
        new vscode.MarkdownString(`\`${word}\` *from* \`${found.module}\``),
        wordRange,
      );
    }
    if (data.types[word]) {
      md.appendCodeblock(word, "jello").appendMarkdown(data.types[word].text);
      this.appendPage(md, data.types[word].page);
      return new vscode.Hover(md, wordRange);
    }
    if (data.namespaces.includes(word)) {
      md.appendMarkdown(`**${word}**: a built-in namespace`);
      this.appendPage(md, "06-stdlib/01-builtins.md");
      return new vscode.Hover(md, wordRange);
    }
    if (inferred) return new vscode.Hover(typeMarkdown(word, inferred.type), wordRange);
    return undefined;
  }

  /** Whether a contextual word is in a place where it means something. */
  private contextual(word: string, document: vscode.TextDocument, range: vscode.Range): boolean {
    const after = document.lineAt(range.end.line).text.slice(range.end.character);
    const before = document.lineAt(range.start.line).text.slice(0, range.start.character);
    switch (word) {
      case "method":
        return /^\s+fn\b/.test(after);
      case "quote":
        return /^\s*\./.test(after);
      case "unquote":
        return /^\s*\(/.test(after);
      case "in":
        return /\bfor\s*\([^)]*$/.test(before);
      default:
        return false;
    }
  }

  private builtinMarkdown(b: Builtin): vscode.MarkdownString {
    const md = new vscode.MarkdownString().appendCodeblock(
      [b.signature, ...(b.overloads ?? [])].join("\n"),
      "jello",
    );
    md.appendMarkdown(b.description);
    this.appendPage(md, "06-stdlib/01-builtins.md");
    return md;
  }

  private declarationMarkdown(d: Declaration, asMethod = false): vscode.MarkdownString {
    const md = new vscode.MarkdownString().appendCodeblock(
      asMethod ? methodSignature(d) : declarationLine(d),
      "jello",
    );
    if (d.doc) md.appendMarkdown(docMarkdown(d.doc));
    return md;
  }

  private noteMarkdown(note: Note | undefined): vscode.MarkdownString | undefined {
    if (!note) return undefined;
    const md = new vscode.MarkdownString(note.text);
    this.appendPage(md, note.page);
    return md;
  }

  /** A link to the page under docs/, when the docs are on this machine. */
  private appendPage(md: vscode.MarkdownString, page: string): void {
    const docs = this.docsDir();
    if (!docs) return;
    md.appendMarkdown(`\n\n[Docs](${vscode.Uri.file(join(docs, page)).toString()})`);
  }

  private docsDir(): string | undefined {
    const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [];
    const jelloc = this.toolchain.get()?.jelloc;
    const candidates = [
      ...folders.map((f) => join(f, "docs")),
      // A Jello checkout's own build: vm/build/jelloc.
      ...(jelloc ? [join(dirname(jelloc), "..", "..", "docs")] : []),
    ];
    return candidates.find((d) => existsSync(join(d, "01-lexical.md")));
  }

  // ---- Signature help -------------------------------------------------------------------------

  private signatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.SignatureHelp | undefined {
    const offset = document.offsetAt(position);
    const text = document.getText(
      new vscode.Range(new vscode.Position(Math.max(0, position.line - 20), 0), position),
    );
    const call = openCall(text);
    if (!call) return undefined;
    const target =
      /(?:([_A-Za-z][_A-Za-z0-9]*)\s*\.\s*)?([_A-Za-z][_A-Za-z0-9]*)\s*(?:<[^<>()]*>)?\s*$/.exec(
        call.callee,
      );
    if (!target) return undefined;
    const [, receiver, name] = target;
    const isNew = /\bnew\s+$/.test(call.callee.slice(0, call.callee.length - target[0].length));

    const shape = receiver
      ? this.memberSignature(document, receiver, name, offset)
      : this.nameSignature(document, name, offset, isNew);
    if (!shape) return undefined;
    const { label, params, doc } = shape;
    const info = new vscode.SignatureInformation(
      label,
      doc ? new vscode.MarkdownString(docMarkdown(doc)) : undefined,
    );
    info.parameters = params.map((p) => new vscode.ParameterInformation(p));
    const help = new vscode.SignatureHelp();
    help.signatures = [info];
    const variadic = params.findIndex((p) => p.startsWith("..."));
    help.activeParameter = variadic >= 0 && call.argument > variadic ? variadic : call.argument;
    return help;
  }

  private memberSignature(
    document: vscode.TextDocument,
    receiver: string,
    name: string,
    offset: number,
  ): Shape | undefined {
    const statics = this.staticMembers(document, receiver, offset);
    const b = statics?.builtins.find((x) => x.name === name);
    if (b) return { ...builtinSignature(b.signature), doc: b.description };
    const d = statics?.declarations.find((x) => x.name === name);
    if (d) return { ...declarationSignature(d, false), doc: d.doc };
    if (statics) return undefined;
    const members = this.membersOfType(document, this.typeOf(document, receiver, offset));
    const mb = members.builtins.find((x) => x.name === name);
    if (mb) return { ...builtinSignature(mb.signature, true), doc: mb.description };
    const md = members.declarations.find((x) => x.name === name);
    return md ? { ...declarationSignature(md, md.kind === "function"), doc: md.doc } : undefined;
  }

  private nameSignature(
    document: vscode.TextDocument,
    name: string,
    offset: number,
    isNew: boolean,
  ): Shape | undefined {
    const found = this.resolveName(document, name, offset);
    let d = found?.declaration;
    if (found && isNew && d?.kind === "prototype") {
      // `new P(…)` passes its arguments to P's init.
      const scan =
        found.file === document.uri.fsPath ? this.scanOf(document) : this.index.ofFile(found.file);
      d = scan?.declarations
        .find((x) => x.kind === "prototype" && x.name === name)
        ?.children.find((c) => c.name === "init");
    }
    return d?.params ? { ...declarationSignature(d, false), doc: d.doc } : undefined;
  }

  // ---- Definitions --------------------------------------------------------------------------

  private definition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location | undefined {
    const file = document.uri.fsPath;
    const scan = this.scanOf(document);
    const offset = document.offsetAt(position);
    const roots = this.workspace.roots(file);

    for (const i of scan.imports) {
      if (offset >= i.moduleStart && offset <= i.moduleEnd) {
        const target = resolveModule(i.module, roots);
        return target
          ? new vscode.Location(vscode.Uri.file(target), new vscode.Position(0, 0))
          : undefined;
      }
      const name = i.names.find((n) => offset >= n.start && offset <= n.end);
      if (name) return this.locate(this.index.exportsOf(i.module, roots), name.name);
    }

    const range = document.getWordRangeAtPosition(position, IDENT);
    if (!range) return undefined;
    const word = document.getText(range);
    const before = document.getText(
      new vscode.Range(new vscode.Position(position.line, 0), range.start),
    );
    const receiver = /([_A-Za-z][_A-Za-z0-9]*)\s*\.\s*$/.exec(before)?.[1];
    if (receiver) {
      if (receiver === "this") {
        const proto = this.enclosingPrototype(scan, offset);
        const member = scan.declarations
          .filter((d) => d.name === proto?.name)
          .flatMap((d) => d.children)
          .find((c) => c.name === word);
        return member ? this.at(file, member.nameStart) : undefined;
      }
      const statics = this.staticMembers(document, receiver, offset);
      const d = statics?.declarations.find((x) => x.name === word);
      if (d && statics?.file) return this.at(statics.file, d.nameStart);
      if (!statics) {
        const members = this.membersOfType(document, this.typeOf(document, receiver, offset));
        const m = members.declarations.find((x) => x.name === word);
        if (m) {
          const owner =
            m.kind === "function"
              ? resolveModule(`std.core.${members.methodsOf[0]}`, roots)
              : this.resolveName(document, members.methodsOf[0], 0)?.file;
          if (owner) return this.at(owner, m.nameStart);
        }
      }
      return undefined;
    }
    const found = this.resolveName(document, word, offset);
    if (found?.local) return this.at(file, found.local.start);
    if (found?.declaration) return this.at(found.file, found.declaration.nameStart);
    if (found?.module) {
      const target = resolveModule(found.module, roots);
      return target
        ? new vscode.Location(vscode.Uri.file(target), new vscode.Position(0, 0))
        : undefined;
    }
    return undefined;
  }

  private locate(
    found: { file: string; declarations: Declaration[] } | undefined,
    name: string,
  ): vscode.Location | undefined {
    const d = found?.declarations.find((x) => x.name === name);
    return found && d ? this.at(found.file, d.nameStart) : undefined;
  }

  /** The location of character `offset` in `file`, which need not be open. */
  private at(file: string, offset: number): vscode.Location {
    const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === file);
    if (open) return new vscode.Location(open.uri, open.positionAt(offset));
    const text = readText(file);
    const lines = text.slice(0, offset).split("\n");
    return new vscode.Location(
      vscode.Uri.file(file),
      new vscode.Position(lines.length - 1, lines[lines.length - 1].length),
    );
  }

  // ---- Symbols, links, highlights, folding -----------------------------------------------

  private symbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const scan = this.scanOf(document);
    const symbol = (d: Declaration): vscode.DocumentSymbol => {
      const full = new vscode.Range(document.positionAt(d.start), document.positionAt(d.end));
      const name = new vscode.Range(
        document.positionAt(d.nameStart),
        document.positionAt(d.nameEnd),
      );
      const s = new vscode.DocumentSymbol(
        d.name,
        symbolDetail(d),
        KIND[d.kind],
        full.contains(name) ? full : name,
        name,
      );
      s.children = d.children.map(symbol);
      return s;
    };
    const out = scan.declarations.map(symbol);
    if (scan.package) {
      const range = new vscode.Range(
        document.positionAt(scan.package.start),
        document.positionAt(scan.package.end),
      );
      out.unshift(
        new vscode.DocumentSymbol(
          scan.package.path,
          "package",
          vscode.SymbolKind.Package,
          range,
          range,
        ),
      );
    }
    return out;
  }

  private async workspaceSymbols(
    query: string,
    token: vscode.CancellationToken,
  ): Promise<vscode.SymbolInformation[]> {
    const files = await vscode.workspace.findFiles(
      "**/*.jello",
      "{**/node_modules/**,**/build/**,**/packages/**}",
      3000,
      token,
    );
    const wanted = query.toLowerCase();
    const out: vscode.SymbolInformation[] = [];
    for (const uri of files) {
      if (token.isCancellationRequested) break;
      const scan = this.index.ofFile(uri.fsPath);
      if (!scan) continue;
      const visit = (d: Declaration, container: string) => {
        if (d.name.toLowerCase().includes(wanted)) {
          out.push(
            new vscode.SymbolInformation(
              d.name,
              KIND[d.kind],
              container,
              this.at(uri.fsPath, d.nameStart),
            ),
          );
        }
        d.children.forEach((c) => visit(c, d.name));
      };
      scan.declarations.forEach((d) => visit(d, vscode.workspace.asRelativePath(uri)));
      if (out.length > 2000) break;
    }
    return out;
  }

  private links(document: vscode.TextDocument): vscode.DocumentLink[] {
    const scan = this.scanOf(document);
    const roots = this.workspace.roots(document.uri.fsPath);
    const out: vscode.DocumentLink[] = [];
    for (const i of scan.imports) {
      if (i.kind === "load") continue;
      const target = resolveModule(i.module, roots);
      if (!target) continue;
      const link = new vscode.DocumentLink(
        new vscode.Range(document.positionAt(i.moduleStart), document.positionAt(i.moduleEnd)),
        vscode.Uri.file(target),
      );
      link.tooltip = `Open ${i.module}`;
      out.push(link);
    }
    return out;
  }

  private highlights(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.DocumentHighlight[] {
    const range = document.getWordRangeAtPosition(position, IDENT);
    if (!range) return [];
    const word = document.getText(range);
    if (KEYWORDS.has(word)) return [];
    return tokenize(document.getText())
      .filter((t) => (t.kind === "ident" || t.kind === "atom") && t.text.replace(/^:/, "") === word)
      .map(
        (t) =>
          new vscode.DocumentHighlight(
            new vscode.Range(
              document.positionAt(t.kind === "atom" ? t.start + 1 : t.start),
              document.positionAt(t.end),
            ),
          ),
      );
  }

  private folding(document: vscode.TextDocument): vscode.FoldingRange[] {
    const tokens = tokenize(document.getText());
    const out: vscode.FoldingRange[] = [];
    const stack: number[] = [];
    let imports: [number, number] | undefined;
    const flushImports = () => {
      if (imports && imports[1] > imports[0]) {
        out.push(new vscode.FoldingRange(imports[0], imports[1], vscode.FoldingRangeKind.Imports));
      }
      imports = undefined;
    };
    for (const t of tokens) {
      const line = document.positionAt(t.start).line;
      if (t.kind === "doc" || (t.kind === "comment" && t.text.startsWith("/*"))) {
        const end = document.positionAt(t.end).line;
        if (end > line)
          out.push(new vscode.FoldingRange(line, end, vscode.FoldingRangeKind.Comment));
      } else if (t.kind === "template") {
        const end = document.positionAt(t.end).line;
        if (end > line) out.push(new vscode.FoldingRange(line, end - 1));
      } else if (t.kind === "keyword" && (t.text === "import" || t.text === "load")) {
        if (imports && line <= imports[1] + 1) imports[1] = line;
        else {
          flushImports();
          imports = [line, line];
        }
      } else if (t.kind === "punct" && (t.text === "{" || t.text === "[" || t.text === "(")) {
        stack.push(line);
      } else if (t.kind === "punct" && (t.text === "}" || t.text === "]" || t.text === ")")) {
        const start = stack.pop();
        if (start !== undefined && line - 1 > start)
          out.push(new vscode.FoldingRange(start, line - 1));
      }
    }
    flushImports();
    return out;
  }
}

// ---- Helpers --------------------------------------------------------------------------------

interface Shape {
  label: string;
  params: string[];
  doc?: string;
}

const readText = (file: string): string => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

/** A declaration as one line of code, `export` and all. */
function declarationLine(d: Declaration): string {
  const lead = d.exported ? "export " : "";
  switch (d.kind) {
    case "function":
      return `${lead}let ${signature(d)}`;
    case "value":
      return `${lead}let ${signature(d)}`;
    case "constant":
      return `${lead}const ${signature(d)}`;
    case "macro":
      return `${lead}macro ${signature(d)}`;
    case "enum":
    case "typedef":
    case "prototype":
      return lead + signature(d);
    default:
      return signature(d);
  }
}

/** A function of a type's namespace, shown as a method of its first parameter. */
function methodSignature(d: Declaration): string {
  const params = (d.params ?? [])
    .slice(1)
    .map((p) => p.text)
    .join(", ");
  return `${d.name}${d.typeParams ?? ""}(${params})${d.result ? `: ${d.result}` : ""}`;
}

function symbolDetail(d: Declaration): string {
  switch (d.kind) {
    case "function":
    case "method":
    case "macro":
      const params = (d.params ?? []).map((p: Param) => p.text).join(", ");
      return `(${params})${d.result ? `: ${d.result}` : ""}`;
    case "variant":
      return d.params ? `(${d.params.map((p) => p.text).join(", ")})` : "";
    default:
      return d.type ?? "";
  }
}

/** Doc comment text as Markdown, with `@param` and `@return` tags set out. */
export function docMarkdown(doc: string): string {
  return doc
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*@param\s+(\S+)\s*/, "\n*@param* `$1` — ")
        .replace(/^\s*@returns?\s*/, "\n*@return* — ")
        .replace(/^\s*@throws\s*/, "\n*@throws* — "),
    )
    .join("\n");
}

function typeMarkdown(word: string, type: string): vscode.MarkdownString {
  return new vscode.MarkdownString().appendCodeblock(`${word}: ${type}`, "jello");
}

/** A signature's label and parameters, from a built-in's documented form. */
function builtinSignature(text: string, asMethod = false): { label: string; params: string[] } {
  const open = text.indexOf("(");
  const close = matchingParen(text, open);
  const params = open < 0 || close < 0 ? [] : splitTopLevel(text.slice(open + 1, close));
  if (!asMethod) return { label: text, params };
  const rest = params.slice(1);
  const name = text.slice(text.lastIndexOf(".", open) + 1, open);
  return { label: `${name}(${rest.join(", ")})${text.slice(close + 1)}`, params: rest };
}

function declarationSignature(
  d: Declaration,
  asMethod: boolean,
): { label: string; params: string[] } {
  const params = (d.params ?? []).map((p) => p.text).slice(asMethod ? 1 : 0);
  return {
    label: `${d.name}(${params.join(", ")})${d.result ? `: ${d.result}` : ""}`,
    params,
  };
}

function matchingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i >= 0 && i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

/** Splits at commas outside brackets. */
export function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ("([{<".includes(c)) depth++;
    else if (")]}>".includes(c) && text[i - 1] !== "-") depth--;
    else if (c === "," && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last) out.push(last);
  return out;
}

/** The call whose parentheses are open at the end of `text`, and which argument is current. */
export function openCall(text: string): { callee: string; argument: number } | undefined {
  const tokens = tokenize(text);
  let depth = 0;
  let argument = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.kind !== "punct") continue;
    if (t.text === ")" || t.text === "]" || t.text === "}") depth++;
    else if (t.text === "[" || t.text === "{") {
      if (depth === 0) return undefined;
      depth--;
    } else if (t.text === "(") {
      if (depth === 0) return { callee: text.slice(0, t.start), argument };
      depth--;
    } else if (t.text === "," && depth === 0) argument++;
    else if (t.text === ";" && depth === 0) return undefined;
  }
  return undefined;
}
