// Where a file sits: its project, the roots its imports resolve against, and how to compile it.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import * as vscode from "vscode";
import { moduleOf, Roots } from "./core/modules";
import { isDirectory, Project, projectFor } from "./core/project";
import { expandPath, Toolchain, Tools } from "./toolchain";

export const isTestFile = (path: string) => path.endsWith(".test.jello");

/** A scratch directory of the extension's own; nothing in it outlives a check. */
export function scratch(...parts: string[]): string {
  const dir = join(tmpdir(), `jello-vscode-${process.pid}`, ...parts);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const inside = (dir: string, path: string) => {
  const rel = relative(dir, path);
  return rel !== "" && !rel.startsWith("..") && !rel.includes(":");
};

export interface Compile {
  args: string[];
  cwd: string;
  /** The file the compiler sees as the entry; its HIR spans carry no path. */
  entry: string;
  /** The real file for a path the compiler reports, where they differ. */
  realPath: (reported: string) => string;
  /** Set for a std module, checked through a generated entry that imports it. */
  stub?: string;
}

export class JelloWorkspace {
  constructor(private readonly toolchain: Toolchain) {}

  project(path: string): Project {
    return projectFor(path);
  }

  /** Extra roots from the settings. */
  private settingRoots(): string[] {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    return vscode.workspace
      .getConfiguration("jello")
      .get<string[]>("paths", [])
      .map((p) => resolve(folder, expandPath(p)));
  }

  /** The roots a module in `path`'s project imports from, the std library last. */
  roots(path: string): Roots {
    const project = this.project(path);
    const sources = [project.src, ...project.packageSrcs, ...this.settingRoots()];
    if (isTestFile(path)) sources.unshift(...project.testDirs);
    // A loose file's siblings are importable too: the compiler searches the input's directory.
    if (!sources.some((s) => inside(s, path))) sources.unshift(dirname(path));
    return { sources: sources.filter(isDirectory), std: this.toolchain.get()?.std };
  }

  /**
   * The command that checks `path`, or a copy of its unsaved `text`, writing the module to
   * `out`, or listing with `listing` (such as `--hir --spans`) instead.
   */
  compile(
    tools: Tools,
    path: string,
    options: { text?: string; listing?: string[] } = {},
  ): Compile {
    const project = this.project(path);
    const roots = this.roots(path);
    const std = tools.std ? ["--std", tools.std] : [];
    const out = options.listing ?? ["--out", join(scratch("out"), `${hash(path)}.jlo`)];
    let entry = path;
    let realPath = (p: string) => p;

    if (options.text !== undefined) {
      // The copy lives alone in a fresh directory under the same name; the real directory comes
      // first among the roots, so its siblings still resolve.
      const dir = scratch("shadow", hash(path));
      entry = join(dir, basename(path));
      writeFileSync(entry, options.text);
      realPath = (p) => (resolve(p) === entry ? path : p);
    }

    if (roots.std && inside(roots.std, path) && options.text === undefined) {
      const module = moduleOf(path, roots);
      if (module) {
        // The compiler preloads std's extension modules under their std paths, so a std module
        // cannot be the entry: E0207. An entry that imports it checks it the same.
        const stub = join(scratch("stub", hash(path)), "Check.jello");
        writeFileSync(stub, `import ${module} as M;\n0\n`);
        return { args: [stub, ...std, ...out], cwd: project.dir, entry: stub, realPath, stub };
      }
    }

    const paths = (list: string[]) => list.flatMap((p) => ["--path", p]);
    if (isTestFile(path)) {
      const root =
        options.text !== undefined
          ? dirname(entry)
          : (project.testDirs.find((d) => inside(d, path)) ?? dirname(path));
      const others = roots.sources.filter((s) => s !== root);
      return {
        args: ["--test", entry, ...paths([root, ...others]), ...std, ...out],
        cwd: project.dir,
        entry,
        realPath,
      };
    }
    const first = options.text !== undefined ? [dirname(path)] : [];
    const sources = [...first, ...roots.sources.filter((s) => s !== dirname(entry))];
    return { args: [entry, ...paths(sources), ...std, ...out], cwd: project.dir, entry, realPath };
  }
}

export const hash = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 12);
