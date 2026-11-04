// Commands, the `jello` task type, and read-only views of what the compiler makes of a file.

import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import * as vscode from "vscode";
import { run } from "./core/process";
import { testPrefix } from "./core/tests";
import { Checker } from "./check";
import { Toolchain } from "./toolchain";
import { isTestFile, JelloWorkspace } from "./workspace";

type TaskCommand = "build" | "run" | "test" | "deps.get";

interface JelloTaskDefinition extends vscode.TaskDefinition {
  command: TaskCommand;
  args?: string[];
}

const SUBCOMMAND: Record<TaskCommand, string[]> = {
  build: [],
  run: ["run"],
  test: ["test"],
  "deps.get": ["deps.get"],
};

const LISTINGS: Record<string, { args: string[]; title: string }> = {
  tokens: { args: ["--lex"], title: "Tokens" },
  hir: { args: ["--hir", "--spans"], title: "HIR" },
  ir: { args: ["--ir"], title: "IR" },
  jlo: { args: ["--jlo"], title: "JLO" },
};

const SCHEME = "jello-listing";

export class Commands implements vscode.TaskProvider, vscode.TextDocumentContentProvider {
  private readonly changed = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.changed.event;

  constructor(
    private readonly toolchain: Toolchain,
    private readonly workspace: JelloWorkspace,
    private readonly checker: Checker,
    private readonly output: vscode.OutputChannel,
  ) {}

  register(): vscode.Disposable[] {
    const command = (id: string, f: (...args: never[]) => unknown) =>
      vscode.commands.registerCommand(id, f);
    return [
      this.changed,
      vscode.tasks.registerTaskProvider("jello", this),
      vscode.workspace.registerTextDocumentContentProvider(SCHEME, this),
      vscode.workspace.onDidSaveTextDocument((d) => {
        // A saved file's open listings are out of date.
        for (const doc of vscode.workspace.textDocuments) {
          if (doc.uri.scheme === SCHEME && doc.uri.query === d.uri.fsPath)
            this.changed.fire(doc.uri);
        }
      }),
      command("jello.runFile", (uri?: vscode.Uri) => this.runFile(uri)),
      command("jello.runProject", () => this.runTask("run")),
      command("jello.runTests", () => this.runTask("test")),
      command("jello.runTestsInFile", (uri?: vscode.Uri) => this.runTestsInFile(uri)),
      command("jello.build", () => this.runTask("build")),
      command("jello.depsGet", () => this.runTask("deps.get")),
      command("jello.newProject", () => this.newProject()),
      command("jello.explain", (code?: string) => this.explain(code)),
      command("jello.check", () => {
        const d = vscode.window.activeTextEditor?.document;
        if (d) void this.checker.check(d);
      }),
      command("jello.locateToolchain", () => this.toolchain.locate()),
      ...Object.keys(LISTINGS).map((kind) =>
        command(`jello.show${kind.charAt(0).toUpperCase()}${kind.slice(1)}`, () =>
          this.showListing(kind),
        ),
      ),
    ];
  }

  // ---- Tasks ----------------------------------------------------------------------------------

  provideTasks(): vscode.Task[] {
    const tools = this.toolchain.get();
    if (!tools) return [];
    const tasks: vscode.Task[] = [];
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const dir = folder.uri.fsPath;
      if (!existsSync(join(dir, "jello.json")) && !existsSync(join(dir, "src", "Main.jello")))
        continue;
      for (const command of Object.keys(SUBCOMMAND) as TaskCommand[]) {
        tasks.push(this.task({ type: "jello", command }, folder, dir));
      }
    }
    return tasks;
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    const definition = task.definition as JelloTaskDefinition;
    if (!SUBCOMMAND[definition.command]) return undefined;
    const folder =
      typeof task.scope === "object" ? task.scope : vscode.workspace.workspaceFolders?.[0];
    return folder ? this.task(definition, folder, folder.uri.fsPath) : undefined;
  }

  private task(
    definition: JelloTaskDefinition,
    folder: vscode.WorkspaceFolder,
    cwd: string,
  ): vscode.Task {
    const tools = this.toolchain.get();
    const args = [...SUBCOMMAND[definition.command], ...(definition.args ?? [])];
    const execution = new vscode.ProcessExecution(tools?.jelloc ?? "jelloc", args, {
      cwd,
      env: stringEnv(this.toolchain.env()),
    });
    const task = new vscode.Task(definition, folder, definition.command, "jello", execution, [
      "$jelloc",
      "$jello-trap",
    ]);
    if (definition.command === "build") task.group = vscode.TaskGroup.Build;
    if (definition.command === "test") task.group = vscode.TaskGroup.Test;
    task.presentationOptions = { clear: true, reveal: vscode.TaskRevealKind.Always };
    return task;
  }

  private async runTask(command: TaskCommand, args: string[] = [], cwd?: string): Promise<void> {
    if (!this.requireTools()) return;
    await vscode.workspace.saveAll(false);
    const dir = cwd ?? this.projectDir();
    if (!dir) {
      void vscode.window.showWarningMessage(
        "Open a Jello file or a folder with a jello.json first.",
      );
      return;
    }
    const folder =
      vscode.workspace.getWorkspaceFolder(vscode.Uri.file(dir)) ??
      vscode.workspace.workspaceFolders?.[0];
    if (!folder) return;
    const task = this.task({ type: "jello", command, args }, folder, dir);
    task.name = args.length > 0 ? `${command} ${args.join(" ")}` : command;
    await vscode.tasks.executeTask(task);
  }

  private projectDir(): string | undefined {
    const active = vscode.window.activeTextEditor?.document;
    if (active?.languageId === "jello" && active.uri.scheme === "file") {
      return this.workspace.project(active.uri.fsPath).dir;
    }
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return folder && this.workspace.project(folder).dir;
  }

  private async runFile(uri?: vscode.Uri): Promise<void> {
    const file = (uri ?? vscode.window.activeTextEditor?.document.uri)?.fsPath;
    if (!file || !file.endsWith(".jello")) return;
    if (isTestFile(file)) return this.runTestsInFile(uri);
    await this.runTask("run", [file], this.workspace.project(file).dir);
  }

  private async runTestsInFile(uri?: vscode.Uri): Promise<void> {
    const file = (uri ?? vscode.window.activeTextEditor?.document.uri)?.fsPath;
    if (!file || !isTestFile(file)) return;
    const project = this.workspace.project(file);
    const root = project.testDirs.find((d) => file.startsWith(d + "/")) ?? join(file, "..");
    const prefix = testPrefix(file.slice(root.length + 1));
    await this.runTask("test", [root, "--", "-v", "--run", prefix + "/"], project.dir);
  }

  private requireTools(): boolean {
    if (this.toolchain.get()) return true;
    void vscode.window
      .showErrorMessage("jelloc was not found.", "Locate…")
      .then((pick) => pick && this.toolchain.locate());
    return false;
  }

  // ---- Projects and errors --------------------------------------------------------------------

  private async newProject(): Promise<void> {
    const tools = this.toolchain.get();
    if (!this.requireTools() || !tools) return;
    if (!tools.jloTool) {
      void vscode.window.showErrorMessage("jlo_tool was not found beside jelloc.");
      return;
    }
    const parent = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel: "Create the project here",
      title: "Where should the new project go?",
    });
    if (!parent?.[0]) return;
    const name = await vscode.window.showInputBox({
      title: "New Jello project",
      prompt: "The project's name, which is also its directory's",
      validateInput: (v) =>
        /^[A-Za-z0-9_.-]+$/.test(v) ? undefined : "Letters, digits, '_', '-' and '.' only",
    });
    if (!name) return;
    const dir = join(parent[0].fsPath, name);
    const result = await run(tools.jloTool, ["init", dir, "--name", name], {
      env: this.toolchain.env(),
    });
    if (result.code !== 0) {
      void vscode.window.showErrorMessage(
        `jlo_tool init failed: ${(result.error ?? result.stderr).trim()}`,
      );
      return;
    }
    const pick = await vscode.window.showInformationMessage(
      `Made ${name}.`,
      "Open",
      "Open in New Window",
    );
    if (pick) {
      await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(dir), {
        forceNewWindow: pick === "Open in New Window",
      });
    }
  }

  private async explain(code?: string): Promise<void> {
    const tools = this.toolchain.get();
    if (!this.requireTools() || !tools) return;
    const wanted =
      typeof code === "string"
        ? code
        : await vscode.window.showInputBox({
            title: "Explain a Jello error code",
            placeHolder: "E0400",
            validateInput: (v) =>
              /^E\d{4}$/i.test(v.trim()) ? undefined : "A code is E and four digits",
          });
    if (!wanted) return;
    const result = await run(tools.jelloc, ["--explain", wanted.trim().toUpperCase()]);
    const text = (result.code === 0 ? result.stdout : result.stderr).trim();
    const [title, ...rest] = text.split("\n");
    await vscode.window.showInformationMessage(title, {
      modal: true,
      detail: rest.join("\n").trim(),
    });
  }

  // ---- Listings -------------------------------------------------------------------------------

  private async showListing(kind: string): Promise<void> {
    const document = vscode.window.activeTextEditor?.document;
    if (!document || document.languageId !== "jello" || !this.requireTools()) return;
    if (document.isDirty) await document.save();
    const path = document.uri.fsPath;
    const uri = vscode.Uri.from({
      scheme: SCHEME,
      path: `/${basename(path)} (${LISTINGS[kind].title})`,
      query: path,
      fragment: kind,
    });
    const shown = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(shown, {
      preview: true,
      viewColumn: vscode.ViewColumn.Beside,
    });
  }

  async provideTextDocumentContent(
    uri: vscode.Uri,
    token: vscode.CancellationToken,
  ): Promise<string> {
    const tools = this.toolchain.get();
    const listing = LISTINGS[uri.fragment];
    if (!tools || !listing) return "jelloc was not found.";
    const compile = this.workspace.compile(tools, uri.query, { listing: listing.args });
    const controller = new AbortController();
    token.onCancellationRequested(() => controller.abort());
    const result = await run(tools.jelloc, compile.args, {
      cwd: compile.cwd,
      env: this.toolchain.env(),
      signal: controller.signal,
      timeoutMs: 60_000,
      maxOutput: 64 * 1024 * 1024,
    });
    if (result.code === 0) return result.stdout;
    this.output.appendLine(`jelloc ${compile.args.join(" ")}\n${result.stderr}`);
    return `// jelloc could not list this file:\n\n${result.error ?? result.stderr}`;
  }
}

function stringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) out[k] = v;
  return out;
}
