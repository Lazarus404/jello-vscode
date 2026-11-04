// Jello tests in VS Code's Test Explorer: a file's top-level `let testName = fn(t: Test)`
// functions, run through `jelloc test` and read back from the runner's `-v` output.

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import * as vscode from "vscode";
import { parseCompilerOutput } from "./core/diagnostics";
import { run } from "./core/process";
import { declaredTests, gotWant, parseRun, TestResult, testPrefix } from "./core/tests";
import { utf16Column } from "./core/text";
import { Toolchain } from "./toolchain";
import { JelloWorkspace } from "./workspace";

interface FileData {
  /** The directory the runner names the file's tests from. */
  root: string;
  projectDir: string;
}

export class JelloTests implements vscode.Disposable, vscode.CodeLensProvider {
  private readonly controller = vscode.tests.createTestController("jello", "Jello");
  private readonly files = new WeakMap<vscode.TestItem, FileData>();
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly lensesChanged = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.lensesChanged.event;

  constructor(
    private readonly toolchain: Toolchain,
    private readonly workspace: JelloWorkspace,
  ) {
    this.controller.resolveHandler = async (item) => {
      if (!item) await this.discoverAll();
      else this.refreshFile(item);
    };
    this.controller.refreshHandler = () => this.discoverAll();
    this.controller.createRunProfile(
      "Run",
      vscode.TestRunProfileKind.Run,
      (request, token) => this.run(request, token),
      true,
    );

    const watcher = vscode.workspace.createFileSystemWatcher("**/*.test.jello");
    this.subscriptions.push(
      this.controller,
      this.lensesChanged,
      watcher,
      watcher.onDidCreate((uri) => this.fileItem(uri)),
      watcher.onDidChange((uri) => {
        const item = this.fileItem(uri);
        if (item) this.refreshFile(item);
      }),
      watcher.onDidDelete((uri) => this.controller.items.delete(uri.toString())),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (!e.document.uri.fsPath.endsWith(".test.jello")) return;
        const item = this.controller.items.get(e.document.uri.toString());
        if (item) this.refreshFile(item, e.document.getText());
      }),
      vscode.languages.registerCodeLensProvider(
        { language: "jello", pattern: "**/*.test.jello" },
        this,
      ),
      vscode.commands.registerCommand("jello.runTestItem", (id: string) => this.runById(id)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("jello.codeLens")) this.lensesChanged.fire();
      }),
    );
  }

  private async discoverAll(): Promise<void> {
    const found = await vscode.workspace.findFiles(
      "**/*.test.jello",
      "{**/node_modules/**,**/build/**,**/packages/**}",
    );
    for (const uri of found) {
      const item = this.fileItem(uri);
      if (item) this.refreshFile(item);
    }
  }

  /** The item for a test file, made on first sight. */
  private fileItem(uri: vscode.Uri): vscode.TestItem | undefined {
    if (uri.scheme !== "file") return undefined;
    const existing = this.controller.items.get(uri.toString());
    if (existing) return existing;
    const project = this.workspace.project(uri.fsPath);
    const root =
      project.testDirs.find((d) => !relative(d, uri.fsPath).startsWith("..")) ??
      dirname(uri.fsPath);
    const prefix = testPrefix(relative(root, uri.fsPath));
    const item = this.controller.createTestItem(uri.toString(), prefix, uri);
    item.canResolveChildren = true;
    this.files.set(item, { root, projectDir: project.dir });
    this.controller.items.add(item);
    return item;
  }

  /** Re-reads a file's tests, from `text` when the file is open and changed. */
  private refreshFile(item: vscode.TestItem, text?: string): void {
    if (!item.uri) return;
    let source = text;
    if (source === undefined) {
      const open = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === item.uri!.toString(),
      );
      try {
        source = open?.getText() ?? readFileSync(item.uri.fsPath, "utf8");
      } catch {
        return;
      }
    }
    const position = (offset: number) => {
      const before = source!.slice(0, offset).split("\n");
      return new vscode.Position(before.length - 1, before[before.length - 1].length);
    };
    const children: vscode.TestItem[] = [];
    for (const test of declaredTests(source)) {
      const id = `${item.label}/${test.name}`;
      const child =
        item.children.get(id) ?? this.controller.createTestItem(id, test.name, item.uri);
      child.range = new vscode.Range(position(test.start), position(test.end));
      children.push(child);
    }
    item.children.replace(children);
    this.lensesChanged.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!vscode.workspace.getConfiguration("jello").get("codeLens", true)) return [];
    const item = this.controller.items.get(document.uri.toString()) ?? this.fileItem(document.uri);
    if (!item) return [];
    if (item.children.size === 0) this.refreshFile(item, document.getText());
    const lenses: vscode.CodeLens[] = [];
    item.children.forEach((child) => {
      if (!child.range) return;
      const at = new vscode.Range(child.range.start, child.range.start);
      lenses.push(
        new vscode.CodeLens(at, {
          title: "$(play) Run test",
          command: "jello.runTestItem",
          arguments: [child.id],
        }),
      );
    });
    if (lenses.length > 0) {
      lenses.unshift(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: "$(run-all) Run file tests",
          command: "jello.runTestItem",
          arguments: [item.id],
        }),
      );
    }
    return lenses;
  }

  private runById(id: string): void {
    let found: vscode.TestItem | undefined;
    this.controller.items.forEach((file) => {
      if (file.id === id) found = file;
      const child = file.children.get(id);
      if (child) found = child;
    });
    if (!found) return;
    const source = new vscode.CancellationTokenSource();
    void this.run(new vscode.TestRunRequest([found]), source.token).finally(() => source.dispose());
  }

  private async run(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const tools = this.toolchain.get();
    const testRun = this.controller.createTestRun(request);
    try {
      if (!tools) {
        testRun.appendOutput("jelloc was not found; set jello.jelloc.path.\r\n");
        return;
      }
      await vscode.workspace.saveAll(false);

      // Group what was asked for by project, since each project builds one test binary.
      const wanted: vscode.TestItem[] = [];
      if (request.include) wanted.push(...request.include);
      else this.controller.items.forEach((i) => wanted.push(i));
      const groups = new Map<string, { roots: Set<string>; items: vscode.TestItem[] }>();
      for (const item of wanted) {
        const file = this.fileOf(item);
        const data = file && this.files.get(file);
        if (!data) continue;
        const group = groups.get(data.projectDir) ?? { roots: new Set(), items: [] };
        group.roots.add(data.root);
        group.items.push(item);
        groups.set(data.projectDir, group);
      }

      for (const [projectDir, group] of groups) {
        if (token.isCancellationRequested) break;
        const leaves = group.items
          .flatMap((item) => this.leaves(item))
          .filter((t) => !request.exclude?.includes(t));
        leaves.forEach((t) => testRun.enqueued(t));
        // One item runs just its own tests; several run everything and keep what was asked.
        const one = group.items.length === 1 ? group.items[0] : undefined;
        const only = one ? ["--run", one.parent ? one.id : `${one.label}/`] : [];
        const args = ["test", ...group.roots, "--", "-v", ...only];
        testRun.appendOutput(`$ jelloc ${args.join(" ")}\r\n`);
        leaves.forEach((t) => testRun.started(t));

        const controller = new AbortController();
        const cancel = token.onCancellationRequested(() => controller.abort());
        const result = await run(tools.jelloc, args, {
          cwd: projectDir,
          env: this.toolchain.env(),
          signal: controller.signal,
          timeoutMs: 10 * 60_000,
        });
        cancel.dispose();
        testRun.appendOutput((result.stdout + result.stderr).replace(/\r?\n/g, "\r\n"));
        this.report(testRun, leaves, result.stdout, result.stderr, projectDir, result.cancelled);
      }
    } finally {
      testRun.end();
    }
  }

  private fileOf(item: vscode.TestItem): vscode.TestItem | undefined {
    let current: vscode.TestItem | undefined = item;
    while (current?.parent) current = current.parent;
    return current;
  }

  /** The tests an item stands for: a test itself, or a file's tests. */
  private leaves(item: vscode.TestItem): vscode.TestItem[] {
    if (item.parent) return [item];
    const out: vscode.TestItem[] = [];
    item.children.forEach((c) => out.push(c));
    return out;
  }

  private report(
    testRun: vscode.TestRun,
    leaves: vscode.TestItem[],
    stdout: string,
    stderr: string,
    projectDir: string,
    cancelled: boolean,
  ): void {
    const output = parseRun(stdout);
    if (output.started.length === 0 && !cancelled) {
      // Nothing ran: the tests did not compile.
      const compile = parseCompilerOutput(stderr);
      const messages = compile.diagnostics.map((d) => {
        const m = new vscode.TestMessage(d.code ? `${d.message} [${d.code}]` : d.message);
        m.location = this.location(projectDir, d.file, d.line, d.column);
        return m;
      });
      const fallback = [new vscode.TestMessage(stderr.trim() || "the test binary did not run")];
      leaves.forEach((t) => testRun.errored(t, messages.length > 0 ? messages : fallback));
      return;
    }
    const byName = new Map(output.results.map((r) => [r.name, r]));
    for (const test of leaves) {
      const result = byName.get(test.id);
      if (!result) {
        if (cancelled) testRun.skipped(test);
        else if (output.started.includes(test.id))
          testRun.errored(test, new vscode.TestMessage("the test did not finish; see the output"));
        else testRun.skipped(test);
        continue;
      }
      this.reportOne(testRun, test, result, projectDir);
      // Subtests become children, so their results show where they belong.
      for (const sub of output.results.filter((r) => r.name.startsWith(test.id + "/"))) {
        const child =
          test.children.get(sub.name) ??
          this.controller.createTestItem(sub.name, sub.name.slice(test.id.length + 1), test.uri);
        test.children.add(child);
        this.reportOne(testRun, child, sub, projectDir);
      }
    }
  }

  private reportOne(
    testRun: vscode.TestRun,
    test: vscode.TestItem,
    result: TestResult,
    projectDir: string,
  ): void {
    if (result.outcome === "passed") {
      testRun.passed(test);
      return;
    }
    if (result.outcome === "skipped") {
      testRun.skipped(test);
      return;
    }
    const messages = result.messages
      .filter((m) => m.file)
      .map((m) => {
        const pair = gotWant(m.text);
        const message = pair
          ? vscode.TestMessage.diff(m.text, pair.want, pair.got)
          : new vscode.TestMessage(m.text);
        message.location = this.location(projectDir, m.file!, m.line!, m.column!);
        return message;
      });
    const log = result.messages
      .filter((m) => !m.file)
      .map((m) => m.text)
      .join("\n");
    if (messages.length === 0) messages.push(new vscode.TestMessage(log || "failed"));
    else if (log) messages[0].message = `${messages[0].message}\n\n${log}`;
    testRun.failed(test, messages);
  }

  private location(
    projectDir: string,
    file: string,
    line: number,
    column: number,
  ): vscode.Location {
    const path = resolve(projectDir, file);
    let text = "";
    try {
      text = readFileSync(path, "utf8").split(/\r?\n/)[line - 1] ?? "";
    } catch {
      /* no column fix */
    }
    return new vscode.Location(
      vscode.Uri.file(path),
      new vscode.Position(Math.max(0, line - 1), utf16Column(text, Math.max(0, column - 1))),
    );
  }

  dispose(): void {
    this.subscriptions.forEach((s) => s.dispose());
  }
}
