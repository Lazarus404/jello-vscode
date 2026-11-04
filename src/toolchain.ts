// Finds the Jello tools and the standard library, and says so in the status bar.

import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import * as vscode from "vscode";
import { isDirectory } from "./core/project";
import { candidates, toolName } from "./core/toolchain";

export interface Tools {
  jelloc: string;
  jello?: string;
  jloTool?: string;
  std?: string;
  version?: string;
}

/** Whether `path` is a program to run; Windows has no execute bit, so there it need only exist. */
const executable = (path: string) => {
  try {
    if (process.platform === "win32") return statSync(path).isFile();
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** `~` and `${workspaceFolder}` in a path from the settings. */
export function expandPath(path: string): string {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  return path.replace(/^~(?=$|[\\/])/, homedir()).replace(/\$\{workspaceFolder\}/g, folder);
}

export class Toolchain implements vscode.Disposable {
  private tools: Tools | undefined | null = null;
  private readonly status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  private readonly changed = new vscode.EventEmitter<void>();
  private readonly subscriptions: vscode.Disposable[] = [];
  readonly onDidChange = this.changed.event;

  constructor() {
    this.status.name = "Jello";
    this.subscriptions.push(
      this.status,
      this.changed,
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration("jello.jelloc.path") ||
          e.affectsConfiguration("jello.std.path")
        ) {
          this.refresh();
        }
      }),
      vscode.window.onDidChangeActiveTextEditor(() => this.show()),
    );
    this.show();
  }

  /** The tools, or undefined when jelloc cannot be found. */
  get(): Tools | undefined {
    if (this.tools === null) this.tools = this.find();
    return this.tools;
  }

  refresh(): void {
    this.tools = null;
    this.show();
    this.changed.fire();
  }

  /** The environment the tools run in: where std is, and where `run` and `test` find jello. */
  env(): NodeJS.ProcessEnv {
    const tools = this.get();
    const env = { ...process.env };
    if (tools?.std) env.JELLO_STD_PATH = tools.std;
    if (tools?.jello) env.JELLO_VM = tools.jello;
    if (tools?.jloTool) env.JELLO_JLO_TOOL = tools.jloTool;
    return env;
  }

  private find(): Tools | undefined {
    const config = vscode.workspace.getConfiguration("jello");
    const configured = config.get<string>("jelloc.path", "").trim();
    const found = candidates({
      configured: configured && resolve(expandPath(configured)),
      folders: vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [],
      env: process.env,
      home: homedir(),
      platform: process.platform,
    }).find((c) => executable(c.jelloc));
    if (!found) return undefined;

    const jelloc = found.jelloc;
    const bin = dirname(jelloc);
    const beside = (name: string) => {
      const path = join(bin, toolName(name, process.platform));
      return executable(path) ? path : undefined;
    };
    const stdSetting = config.get<string>("std.path", "").trim();
    const std = [
      stdSetting && resolve(expandPath(stdSetting)),
      found.std,
      process.env.JELLO_STD_PATH,
      join(bin, "..", "std"),
      ...(vscode.workspace.workspaceFolders ?? []).map((f) => join(f.uri.fsPath, "stdlib")),
    ].find((d): d is string => !!d && isDirectory(d));

    let version: string | undefined;
    try {
      version = readFileSync(join(bin, "..", "VERSION"), "utf8")
        .trim()
        .split(/\s+/)[0];
    } catch {
      version = undefined;
    }
    return {
      jelloc,
      jello: beside("jello"),
      jloTool: beside("jlo_tool"),
      std: std && resolve(std),
      version,
    };
  }

  private show(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId !== "jello") {
      this.status.hide();
      return;
    }
    const tools = this.get();
    if (tools) {
      this.status.text = `$(beaker) Jello${tools.version ? " " + tools.version : ""}`;
      this.status.tooltip = new vscode.MarkdownString(
        `**jelloc** \`${tools.jelloc}\`\n\n**std** \`${tools.std ?? "not found"}\``,
      );
      this.status.command = "jello.locateToolchain";
      this.status.backgroundColor = undefined;
    } else {
      this.status.text = "$(warning) Jello: jelloc not found";
      this.status.tooltip = "Set jello.jelloc.path, or put jelloc on PATH. Click to locate it.";
      this.status.command = "jello.locateToolchain";
      this.status.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    }
    this.status.show();
  }

  /** Asks for jelloc's location and saves it in the user settings. */
  async locate(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: "Use this jelloc",
      title: "Locate jelloc",
    });
    if (!picked?.[0]) return;
    await vscode.workspace
      .getConfiguration("jello")
      .update("jelloc.path", picked[0].fsPath, vscode.ConfigurationTarget.Global);
    this.refresh();
  }

  dispose(): void {
    this.subscriptions.forEach((s) => s.dispose());
  }
}
