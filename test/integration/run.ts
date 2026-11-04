// Runs the integration suite in a real VS Code: the installed one, or $VSCODE_PATH, against a
// small project made fresh for each run.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runTests } from "@vscode/test-electron";
import { jelloc, repo, std } from "../support";

const files: Record<string, string> = {
  "jello.json": '{ "name": "demo" }\n',
  ".vscode/settings.json": JSON.stringify(
    {
      "jello.jelloc.path": jelloc,
      "jello.std.path": std,
    },
    null,
    2,
  ),
  "src/geo/Shapes.jello": `package geo;

/** A shape we can measure. */
export enum Shape {
  Square(side: I32);
  /** A circle, roughly. */
  Circle(radius: I32);
}

/** The area of a shape.
 * @param shape  what to measure */
export let area = fn(shape: Shape): I32 {
  match (shape) { Square(side) => side * side, Circle(r) => 3 * r * r }
};
`,
  "src/Main.jello": `import { Shape, area } from geo.Shapes;
import std.testing as T;

let xs: Array<I32> = [area(Shape.Square(3)), 4];
let total = xs.len() + 2;
let top = Math.max(1.5, 2.5);
let word = "jello";
Std.string(total) + word
`,
  "src/Bad.jello": `let x: I32 = "a";
x
`,
  "tests/Shapes.test.jello": `import type { Test } from std.testing;
import std.testing as T;
import { Shape, area } from geo.Shapes;

let testSquare = fn(t: Test) {
  T.equal(t, area(Shape.Square(2)), 4);
};

let testCircle = fn(t: Test) {
  T.equal(t, area(Shape.Circle(1)), 4);
};
`,
};

async function main(): Promise<void> {
  if (!jelloc) throw new Error("no jelloc found; set JELLOC");
  const project = mkdtempSync(join(tmpdir(), "jello-it-"));
  for (const [path, text] of Object.entries(files)) {
    const full = join(project, path);
    mkdirSync(resolve(full, ".."), { recursive: true });
    writeFileSync(full, text);
  }
  await runTests({
    vscodeExecutablePath:
      process.env.VSCODE_PATH ?? "/Applications/Visual Studio Code.app/Contents/MacOS/Code",
    extensionDevelopmentPath: resolve(__dirname, "..", "..", ".."),
    extensionTestsPath: resolve(__dirname, "suite"),
    launchArgs: [
      project,
      "--disable-extensions",
      "--skip-welcome",
      "--skip-release-notes",
      "--user-data-dir",
      mkdtempSync(join(tmpdir(), "jello-it-user-")),
    ],
    extensionTestsEnv: { JELLO_IT_PROJECT: project, JELLO_REPO: repo },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
