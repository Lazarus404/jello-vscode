// Diagnostics from the compiler: a file is checked when it is opened or saved, and, if asked,
// while it is being typed.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as vscode from "vscode";
import { CompilerDiagnostic, parseCompilerOutput } from "./core/diagnostics";
import { run } from "./core/process";
import { utf16Column } from "./core/text";
import { HoverTypes } from "./hoverTypes";
import { Toolchain } from "./toolchain";
import { JelloWorkspace } from "./workspace";

const SEVERITY: Record<CompilerDiagnostic["severity"], vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
};

export class Checker implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection("jello");
  private readonly output: vscode.OutputChannel;
  /** For each checked file, the diagnostics its check reported, by the file they are in. */
  private readonly reports = new Map<string, Map<string, vscode.Diagnostic[]>>();
  private readonly running = new Map<string, AbortController>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly subscriptions: vscode.Disposable[] = [];
  private warnedInternal = false;

  constructor(
    private readonly toolchain: Toolchain,
    private readonly workspace: JelloWorkspace,
    private readonly types: HoverTypes,
    output: vscode.OutputChannel,
  ) {
    this.output = output;
    const config = () => vscode.workspace.getConfiguration("jello");
    this.subscriptions.push(
      this.collection,
      vscode.workspace.onDidOpenTextDocument((d) => {
        if (config().get("check.onSave", true)) this.schedule(d, 0);
      }),
      vscode.workspace.onDidSaveTextDocument((d) => {
        if (!config().get("check.onSave", true)) return;
        this.schedule(d, 0);
        // A file that imports this one may have reported its errors; check it again too.
        for (const [checked, report] of this.reports) {
          const importer = vscode.workspace.textDocuments.find((x) => x.uri.fsPath === checked);
          if (checked !== d.uri.fsPath && report.has(d.uri.fsPath) && importer)
            this.schedule(importer, 0);
        }
      }),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length > 0 && config().get("check.onType", false)) {
          this.schedule(e.document, 500);
        }
      }),
      vscode.workspace.onDidCloseTextDocument((d) => this.forget(d.uri.fsPath)),
      toolchain.onDidChange(() => this.checkOpen()),
    );
  }

  /** Checks every open Jello document, as on start-up. */
  checkOpen(): void {
    for (const d of vscode.workspace.textDocuments) this.schedule(d, 0);
  }

  schedule(document: vscode.TextDocument, delayMs: number): void {
    if (document.languageId !== "jello" || document.uri.scheme !== "file") return;
    const path = document.uri.fsPath;
    clearTimeout(this.timers.get(path));
    this.timers.set(
      path,
      setTimeout(() => {
        this.timers.delete(path);
        void this.check(document);
      }, delayMs),
    );
  }

  async check(document: vscode.TextDocument): Promise<void> {
    const tools = this.toolchain.get();
    if (!tools) return;
    const path = document.uri.fsPath;
    this.running.get(path)?.abort();
    const controller = new AbortController();
    this.running.set(path, controller);

    const text = document.isDirty ? document.getText() : undefined;
    const compile = this.workspace.compile(tools, path, { text });
    const timeoutMs = vscode.workspace
      .getConfiguration("jello")
      .get<number>("check.timeoutMs", 10_000);
    const result = await run(tools.jelloc, compile.args, {
      cwd: compile.cwd,
      env: this.toolchain.env(),
      signal: controller.signal,
      timeoutMs,
    });
    if (this.running.get(path) !== controller) return;
    this.running.delete(path);
    if (result.cancelled) return;

    if (result.error || result.timedOut || result.code === 2) {
      const why =
        result.error ??
        (result.timedOut ? `timed out after ${timeoutMs} ms` : result.stderr.trim());
      this.output.appendLine(`jelloc ${compile.args.join(" ")}\n  ${why}`);
      if (result.code === 2)
        this.report(path, new Map([[path, [this.wholeFile(`jelloc: ${firstLine(why)}`)]]]));
      return;
    }

    const parsed = parseCompilerOutput(result.stderr);
    if (result.code === 3 || parsed.internal) {
      this.output.appendLine(parsed.internal ?? result.stderr);
      if (!this.warnedInternal) {
        this.warnedInternal = true;
        void vscode.window
          .showErrorMessage(
            "jelloc hit an internal error checking this file; that is a compiler bug. See the Jello output.",
            "Show Output",
          )
          .then((pick) => pick && this.output.show(true));
      }
      return;
    }

    const byFile = new Map<string, vscode.Diagnostic[]>();
    const add = (file: string, d: vscode.Diagnostic) => {
      byFile.set(file, [...(byFile.get(file) ?? []), d]);
    };
    for (const d of parsed.diagnostics) {
      const file = compile.realPath(resolve(compile.cwd, d.file));
      if (compile.stub && file === compile.stub) continue;
      const diagnostic = new vscode.Diagnostic(
        this.range(file, d.line, d.column, document),
        d.message,
        SEVERITY[d.severity],
      );
      diagnostic.source = "jelloc";
      if (d.code) {
        diagnostic.code = {
          value: d.code,
          target: vscode.Uri.parse(
            `command:jello.explain?${encodeURIComponent(JSON.stringify([d.code]))}`,
          ),
        };
      }
      diagnostic.relatedInformation = d.notes.map((n) => {
        const noteFile = compile.realPath(resolve(compile.cwd, n.file));
        return new vscode.DiagnosticRelatedInformation(
          new vscode.Location(
            vscode.Uri.file(noteFile),
            this.range(noteFile, n.line, n.column, document),
          ),
          n.message,
        );
      });
      add(file, diagnostic);
    }
    if (parsed.stopped) {
      const note = this.wholeFile(
        "The compiler stopped after 20 errors; fix these and check again.",
      );
      note.severity = vscode.DiagnosticSeverity.Information;
      add(path, note);
    }
    if (result.code !== 0 && byFile.size === 0) {
      const message = parsed.other.join("\n") || result.stderr.trim() || "jelloc failed";
      add(path, this.wholeFile(message));
    }
    this.report(path, byFile);
    if (result.code === 0 && !document.isDirty) void this.types.refresh(document);
  }

  /** The range of the word at a compiler place: line and column count characters from 1. */
  private range(
    file: string,
    line: number,
    column: number,
    document: vscode.TextDocument,
  ): vscode.Range {
    const open =
      document.uri.fsPath === file
        ? document
        : vscode.workspace.textDocuments.find((d) => d.uri.fsPath === file);
    const lineIndex = Math.max(0, line - 1);
    const lineText = open
      ? lineIndex < open.lineCount
        ? open.lineAt(lineIndex).text
        : ""
      : (readLines(file)[lineIndex] ?? "");
    const character = utf16Column(lineText, Math.max(0, column - 1));
    const start = new vscode.Position(lineIndex, character);
    const word = /^[_A-Za-z0-9]+/.exec(lineText.slice(character))?.[0].length ?? 1;
    return new vscode.Range(
      start,
      start.translate(0, Math.max(1, Math.min(word, lineText.length - character))),
    );
  }

  private wholeFile(message: string): vscode.Diagnostic {
    const d = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      message,
      vscode.DiagnosticSeverity.Error,
    );
    d.source = "jelloc";
    return d;
  }

  /** Records what checking `checked` found, and shows each file's union over every check. */
  private report(checked: string, byFile: Map<string, vscode.Diagnostic[]>): void {
    const before = this.reports.get(checked);
    this.reports.set(checked, byFile);
    const touched = new Set([...(before?.keys() ?? []), ...byFile.keys(), checked]);
    for (const file of touched) {
      const all: vscode.Diagnostic[] = [];
      for (const report of this.reports.values()) all.push(...(report.get(file) ?? []));
      this.collection.set(vscode.Uri.file(file), dedupe(all));
    }
  }

  private forget(path: string): void {
    clearTimeout(this.timers.get(path));
    this.running.get(path)?.abort();
    this.types.forget(path);
    if (this.reports.has(path)) this.report(path, new Map());
    this.reports.delete(path);
  }

  dispose(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.running.forEach((c) => c.abort());
    this.subscriptions.forEach((s) => s.dispose());
  }
}

const firstLine = (text: string) => text.split("\n")[0];

function readLines(file: string): string[] {
  try {
    return readFileSync(file, "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
}

/** Two checks that both import a module report its errors twice; once is plenty. */
function dedupe(list: vscode.Diagnostic[]): vscode.Diagnostic[] {
  const seen = new Set<string>();
  return list.filter((d) => {
    const key = `${d.range.start.line}:${d.range.start.character}:${d.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
