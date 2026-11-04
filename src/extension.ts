// Jello for VS Code. Every feature runs in the extension host and asks jelloc whatever only the
// compiler can answer; there is no language server to keep in step with the language.

import * as vscode from "vscode";
import { Checker } from "./check";
import { Commands } from "./commands";
import { HoverTypes } from "./hoverTypes";
import { JelloLanguage } from "./language";
import { ModuleIndex } from "./moduleIndex";
import { JelloTests } from "./testing";
import { Toolchain } from "./toolchain";
import { isTestFile, JelloWorkspace } from "./workspace";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Jello");
  const toolchain = new Toolchain();
  const workspace = new JelloWorkspace(toolchain);
  const index = new ModuleIndex();
  const types = new HoverTypes(toolchain, workspace);
  const checker = new Checker(toolchain, workspace, types, output);
  const commands = new Commands(toolchain, workspace, checker, output);
  const tests = new JelloTests(toolchain, workspace);
  const language = new JelloLanguage(index, workspace, toolchain, types);

  const watcher = vscode.workspace.createFileSystemWatcher("**/*.jello");
  const forget = (uri: vscode.Uri) => index.forget(uri.fsPath);

  context.subscriptions.push(
    output,
    toolchain,
    checker,
    tests,
    watcher,
    watcher.onDidChange(forget),
    watcher.onDidCreate(forget),
    watcher.onDidDelete(forget),
    ...commands.register(),
    ...language.register(),
    vscode.window.onDidChangeActiveTextEditor(setContext),
    vscode.languages.registerCodeActionsProvider(
      { language: "jello" },
      { provideCodeActions: explainActions },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );
  setContext(vscode.window.activeTextEditor);
  checker.checkOpen();

  function setContext(editor: vscode.TextEditor | undefined): void {
    const path = editor?.document.languageId === "jello" ? editor.document.uri.fsPath : undefined;
    void vscode.commands.executeCommand(
      "setContext",
      "jello.isTestFile",
      !!path && isTestFile(path),
    );
    void vscode.commands.executeCommand(
      "setContext",
      "jello.inProject",
      !!path && workspace.project(path).hasManifest,
    );
  }
}

/** "Explain E0400" for each coded diagnostic under the cursor. */
function explainActions(
  _d: vscode.TextDocument,
  _r: vscode.Range,
  context: vscode.CodeActionContext,
): vscode.CodeAction[] {
  const codes = new Set<string>();
  for (const d of context.diagnostics) {
    const code = typeof d.code === "object" ? d.code.value : d.code;
    if (d.source === "jelloc" && typeof code === "string") codes.add(code);
  }
  return [...codes].map((code) => {
    const action = new vscode.CodeAction(`Explain ${code}`, vscode.CodeActionKind.QuickFix);
    action.command = { command: "jello.explain", title: `Explain ${code}`, arguments: [code] };
    return action;
  });
}

export function deactivate(): void {}
