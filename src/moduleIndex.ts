// Scans of open documents and of files on disk, kept until they change.

import { readFileSync, statSync } from "node:fs";
import * as vscode from "vscode";
import { listModules, resolveModule, Roots } from "./core/modules";
import { Declaration, Param, scan, Scan } from "./core/scan";

/** The assertions the compiler declares in std.testing; the file itself only mentions them. */
export const ASSERTIONS: [name: string, params: string[], doc: string][] = [
  ["equal", ["t: Test", "got: T", "want: T"], "Fails `t` unless `got == want`, showing both."],
  ["notEqual", ["t: Test", "got: T", "want: T"], "Fails `t` when `got == want`."],
  ["isTrue", ["t: Test", "condition: Bool"], "Fails `t` unless `condition` holds."],
  ["isNull", ["t: Test", "value: ?T"], "Fails `t` unless `value` is null."],
  ["throws", ["t: Test", "body: () -> Null"], "Fails `t` unless `body` throws."],
];

const assertions = (): Declaration[] =>
  ASSERTIONS.map(([name, params, doc]) => ({
    kind: "function",
    name,
    exported: true,
    nameStart: 0,
    nameEnd: 0,
    start: 0,
    end: 0,
    typeParams: params.some((p) => /:.*\bT\b/.test(p)) ? "<T>" : undefined,
    params: params.map((text): Param => ({
      name: text.split(":")[0],
      type: text.split(": ")[1],
      text,
    })),
    result: "Null",
    doc,
    children: [],
  }));

interface Cached {
  key: string;
  scan: Scan;
}

export class ModuleIndex {
  private readonly cache = new Map<string, Cached>();
  private modules: { key: string; at: number; list: string[] } | undefined;

  /** The scan of an open document, at its current version. */
  ofDocument(document: vscode.TextDocument): Scan {
    const key = `v${document.version}`;
    const path = document.uri.fsPath;
    const hit = this.cache.get(path);
    if (hit?.key === key) return hit.scan;
    const result = scan(document.getText());
    this.cache.set(path, { key, scan: result });
    return result;
  }

  /** The scan of a file, from its open document when there is one. */
  ofFile(path: string): Scan | undefined {
    const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === path);
    if (open) return this.ofDocument(open);
    let key: string;
    try {
      key = `m${statSync(path).mtimeMs}`;
    } catch {
      return undefined;
    }
    const hit = this.cache.get(path);
    if (hit?.key === key) return hit.scan;
    try {
      const result = scan(readFileSync(path, "utf8"));
      this.cache.set(path, { key, scan: result });
      return result;
    } catch {
      return undefined;
    }
  }

  /** What a module exports, by its import path. */
  exportsOf(
    module: string,
    roots: Roots,
  ): { file: string; declarations: Declaration[] } | undefined {
    const file = resolveModule(module, roots);
    const found = file && this.ofFile(file);
    if (!file || !found) return undefined;
    const declarations = found.declarations.filter((d) => d.exported);
    return {
      file,
      declarations: module === "std.testing" ? [...assertions(), ...declarations] : declarations,
    };
  }

  /** Every module path the roots offer; listed again at most every few seconds. */
  moduleList(roots: Roots): string[] {
    const key = JSON.stringify(roots);
    const now = Date.now();
    if (this.modules?.key === key && now - this.modules.at < 5000) return this.modules.list;
    const list = listModules(roots);
    this.modules = { key, at: now, list };
    return list;
  }

  forget(path: string): void {
    this.cache.delete(path);
    this.modules = undefined;
  }
}
