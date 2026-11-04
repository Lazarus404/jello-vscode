// What a developer would try first, done through VS Code's own commands.

import assert from "node:assert/strict";
import { join } from "node:path";
import * as vscode from "vscode";

const project = process.env.JELLO_IT_PROJECT!;
const uri = (path: string) => vscode.Uri.file(join(project, path));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(
  what: string,
  f: () => T | undefined | Promise<T | undefined>,
  ms = 20_000,
): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await f();
    if (value) return value;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

async function open(path: string): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(uri(path));
  await vscode.window.showTextDocument(document);
  return document;
}

const at = (document: vscode.TextDocument, needle: string, delta = 0) =>
  document.positionAt(document.getText().indexOf(needle) + delta);

async function labels(
  document: vscode.TextDocument,
  position: vscode.Position,
  trigger?: string,
): Promise<string[]> {
  const list = await vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    document.uri,
    position,
    trigger,
  );
  // Contributed snippets come with every list; only the provider's own items are checked.
  return list.items
    .filter((i) => i.kind !== vscode.CompletionItemKind.Snippet)
    .map((i) => (typeof i.label === "string" ? i.label : i.label.label));
}

async function hoverText(
  document: vscode.TextDocument,
  position: vscode.Position,
): Promise<string> {
  const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
    "vscode.executeHoverProvider",
    document.uri,
    position,
  );
  return hovers
    .flatMap((h) =>
      h.contents.map((c) => (typeof c === "string" ? c : "value" in c ? c.value : "")),
    )
    .join("\n");
}

/** A scratch document whose text is `text`, to complete in. */
async function scratch(text: string): Promise<vscode.TextDocument> {
  const document = await open("src/Main.jello");
  const editor = vscode.window.activeTextEditor!;
  await editor.edit((e) => e.replace(new vscode.Range(0, 0, document.lineCount, 0), text));
  return document;
}

const tests: [string, () => Promise<void>][] = [
  [
    "the extension activates on a Jello file",
    async () => {
      await open("src/Main.jello");
      const extension = vscode.extensions.all.find((e) => e.packageJSON.name === "jello-language");
      assert.ok(extension, "extension not found");
      await until("activation", () => extension.isActive);
    },
  ],

  [
    "a type error comes back from jelloc with its code",
    async () => {
      const document = await open("src/Bad.jello");
      const diagnostics = await until("diagnostics", () => {
        const list = vscode.languages.getDiagnostics(document.uri);
        return list.length > 0 ? list : undefined;
      });
      assert.equal(diagnostics[0].range.start.line, 0);
      assert.equal(diagnostics[0].range.start.character, 13);
      assert.match(diagnostics[0].message, /annotated I32, but its value is Bytes/);
      const code = diagnostics[0].code as { value: string };
      assert.equal(code.value, "E0400");
      const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        "vscode.executeCodeActionProvider",
        document.uri,
        diagnostics[0].range,
      );
      assert.ok(actions.some((a) => a.title === "Explain E0400"));
    },
  ],

  [
    "a clean file has no diagnostics",
    async () => {
      const document = await open("src/Main.jello");
      await sleep(1500);
      assert.deepEqual(
        vscode.languages.getDiagnostics(document.uri).map((d) => d.message),
        [],
      );
    },
  ],

  [
    "hover shows signatures, doc comments, keywords and inferred types",
    async () => {
      const document = await open("src/Main.jello");
      const area = await hoverText(document, at(document, "area(Shape", 1));
      assert.match(area, /area\(shape: Shape\): I32/);
      assert.match(area, /The area of a shape/);
      assert.match(area, /geo\.Shapes/);
      const max = await hoverText(document, at(document, "max(", 1));
      assert.match(max, /Math\.max/);
      const word = await until("an inferred type", async () => {
        const text = await hoverText(document, at(document, "word =", 1));
        return /Bytes/.test(text) ? text : undefined;
      });
      assert.match(word, /word: Bytes|Bytes/);
    },
  ],

  [
    "go to definition reaches into another module",
    async () => {
      const document = await open("src/Main.jello");
      const found = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeDefinitionProvider",
        document.uri,
        at(document, "area(Shape", 1),
      );
      assert.equal(found[0].uri.fsPath, uri("src/geo/Shapes.jello").fsPath);
      assert.equal(found[0].range.start.line, 11);
      const module = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeDefinitionProvider",
        document.uri,
        at(document, "geo.Shapes", 2),
      );
      assert.equal(module[0].uri.fsPath, uri("src/geo/Shapes.jello").fsPath);
    },
  ],

  [
    "signature help names the parameter",
    async () => {
      const document = await scratch("import { area } from geo.Shapes;\nlet a = area(\n");
      const help = await vscode.commands.executeCommand<vscode.SignatureHelp>(
        "vscode.executeSignatureHelpProvider",
        document.uri,
        new vscode.Position(1, 13),
        "(",
      );
      assert.equal(help.signatures[0].label, "area(shape: Shape): I32");
    },
  ],

  [
    "completion knows modules, namespaces, aliases, enums and methods",
    async () => {
      let document = await scratch("import { Shape } from ");
      const modules = await labels(document, new vscode.Position(0, 22));
      assert.ok(modules.includes("geo") && modules.includes("std"), modules.join(","));

      document = await scratch("import { Shape } from std.co");
      assert.ok((await labels(document, new vscode.Position(0, 28))).includes("core"));

      document = await scratch("import {  } from geo.Shapes;");
      const exported = await labels(document, new vscode.Position(0, 9));
      assert.deepEqual(exported.sort(), ["Shape", "area"], exported.join(","));

      document = await scratch("import std.testing as T;\nlet a = T.");
      const testing = await labels(document, new vscode.Position(1, 10), ".");
      assert.ok(testing.includes("equal") && testing.includes("fail"), testing.join(","));

      document = await scratch("let a = Math.");
      assert.ok((await labels(document, new vscode.Position(0, 13), ".")).includes("sqrt"));

      document = await scratch("import { Shape } from geo.Shapes;\nlet s = Shape.");
      assert.deepEqual((await labels(document, new vscode.Position(1, 14), ".")).sort(), [
        "Circle",
        "Square",
      ]);

      document = await scratch("let xs: Array<I32> = [];\nxs.");
      const methods = await labels(document, new vscode.Position(1, 3), ".");
      assert.ok(methods.includes("push") && methods.includes("map"), methods.join(","));

      document = await scratch("let total = 1;\nlet f = fn(count: I32) { co");
      const names = await labels(document, new vscode.Position(1, 27));
      assert.ok(names.includes("count") && names.includes("total") && names.includes("const"));
    },
  ],

  [
    "a test file checks clean, assertions and all",
    async () => {
      const document = await open("tests/Shapes.test.jello");
      await sleep(2000);
      assert.deepEqual(
        vscode.languages.getDiagnostics(document.uri).map((d) => d.message),
        [],
      );
      const help = await vscode.commands.executeCommand<vscode.SignatureHelp>(
        "vscode.executeSignatureHelpProvider",
        document.uri,
        at(document, "area(Shape.Square", -2),
        "(",
      );
      assert.equal(help.signatures[0].label, "equal(t: Test, got: T, want: T): Null");
      assert.match(await hoverText(document, at(document, "equal(", 1)), /equal<T>\(t: Test/);
      const edited = await scratch("import std.testing as T;\nlet f = fn(t: T.Test) { T.isTrue(");
      const isTrue = await vscode.commands.executeCommand<vscode.SignatureHelp>(
        "vscode.executeSignatureHelpProvider",
        edited.uri,
        new vscode.Position(1, 33),
        "(",
      );
      assert.equal(isTrue.signatures[0].label, "isTrue(t: Test, condition: Bool): Null");
      assert.match(await hoverText(edited, new vscode.Position(1, 29)), /isTrue\(t: Test/);
    },
  ],

  [
    "go to definition reaches into std",
    async () => {
      const document = await scratch(
        'import { split } from std.core.Bytes;\nlet parts = split("a,b", ",");\n',
      );
      const found = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeDefinitionProvider",
        document.uri,
        new vscode.Position(1, 14),
      );
      assert.match(found[0].uri.fsPath, /stdlib\/core\/Bytes\.jello$/);
    },
  ],

  [
    "the outline lists variants and functions",
    async () => {
      const document = await open("src/geo/Shapes.jello");
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        "vscode.executeDocumentSymbolProvider",
        document.uri,
      );
      assert.deepEqual(
        symbols.map((s) => s.name),
        ["geo", "Shape", "area"],
      );
      assert.deepEqual(
        symbols[1].children.map((c) => c.name),
        ["Square", "Circle"],
      );
    },
  ],

  [
    "tests show code lenses",
    async () => {
      const document = await open("tests/Shapes.test.jello");
      const lenses = await until("code lenses", async () => {
        const list = await vscode.commands.executeCommand<vscode.CodeLens[]>(
          "vscode.executeCodeLensProvider",
          document.uri,
          10,
        );
        return list.length > 0 ? list : undefined;
      });
      assert.deepEqual(
        lenses.map((l) => l.command?.arguments?.[0]),
        [document.uri.toString(), "Shapes/testSquare", "Shapes/testCircle"],
      );
    },
  ],

  [
    "the jello tasks are offered",
    async () => {
      const tasks = await vscode.tasks.fetchTasks({ type: "jello" });
      assert.deepEqual(tasks.map((t) => t.name).sort(), ["build", "deps.get", "run", "test"]);
    },
  ],

  [
    "a HIR listing opens beside the file",
    async () => {
      await open("src/Main.jello");
      await vscode.commands.executeCommand("jello.showHir");
      const listing = await until("a listing", () =>
        vscode.workspace.textDocuments.find(
          (d) => d.uri.scheme === "jello-listing" && d.getText().startsWith("program"),
        ),
      );
      assert.match(listing.getText(), /@\d+\.\.\d+/);
    },
  ],

  [
    "without jelloc, the static features still work",
    async () => {
      const config = vscode.workspace.getConfiguration("jello");
      await config.update("jelloc.path", "/nowhere/jelloc", vscode.ConfigurationTarget.Workspace);
      try {
        const document = await open("src/Bad.jello");
        await vscode.commands.executeCommand("jello.check");
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          "vscode.executeDocumentSymbolProvider",
          document.uri,
        );
        assert.deepEqual(
          symbols.map((s) => s.name),
          ["x"],
        );
        const edited = await scratch("let a = Math.");
        assert.ok((await labels(edited, new vscode.Position(0, 13), ".")).includes("sqrt"));
      } finally {
        await config.update("jelloc.path", undefined, vscode.ConfigurationTarget.Workspace);
      }
    },
  ],
];

/** Puts back whatever a test edited, so one failure does not take the next test with it. */
async function revertAll(): Promise<void> {
  for (const document of vscode.workspace.textDocuments.filter(
    (d) => d.isDirty && d.uri.scheme === "file",
  )) {
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand("workbench.action.files.revert");
  }
}

export async function run(): Promise<void> {
  const failures: string[] = [];
  for (const [name, f] of tests) {
    try {
      await f();
      console.log(`  ✔ ${name}`);
    } catch (e) {
      console.log(
        `  ✖ ${name}\n    ${String(e instanceof Error ? e.stack : e)
          .split("\n")
          .slice(0, 6)
          .join("\n    ")}`,
      );
      failures.push(name);
    }
    await revertAll();
  }
  if (failures.length > 0) throw new Error(`${failures.length} integration test(s) failed`);
}
