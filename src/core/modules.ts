// Module paths and the files they name: `a.b.C` is `a/b/C.jello` under a source root, and
// `std.core.Array` is `core/Array.jello` under the standard library.

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface Roots {
  /** Source roots, searched in order. */
  sources: string[];
  std?: string;
}

/** The file a module path names, if one exists. */
export function resolveModule(module: string, roots: Roots): string | undefined {
  const parts = module.split(".");
  const candidates =
    parts[0] === "std" && roots.std
      ? [join(roots.std, ...parts.slice(1)) + ".jello"]
      : roots.sources.map((root) => join(root, ...parts) + ".jello");
  return candidates.find(isFile);
}

/** The module path of `file` under the first root that holds it. */
export function moduleOf(file: string, roots: Roots): string | undefined {
  const under = (root: string) => {
    const rel = relative(root, file);
    return rel.startsWith("..") || rel.includes(":") ? undefined : rel;
  };
  if (roots.std) {
    const rel = under(roots.std);
    if (rel !== undefined) return "std." + dotted(rel);
  }
  for (const root of roots.sources) {
    const rel = under(root);
    if (rel !== undefined) return dotted(rel);
  }
  return undefined;
}

const dotted = (rel: string) =>
  rel
    .replace(/\.jello$/, "")
    .split(sep)
    .join(".");

const SKIP = new Set(["node_modules", "build", "packages", ".git", "out"]);

/** Every module path the roots offer, test files left out. */
export function listModules(roots: Roots, limit = 5000): string[] {
  const out = new Set<string>();
  const walk = (dir: string, prefix: string[]) => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (out.size >= limit) return;
      const path = join(dir, name);
      if (name.endsWith(".jello")) {
        if (!name.endsWith(".test.jello")) out.add([...prefix, name.slice(0, -6)].join("."));
      } else if (!SKIP.has(name) && !name.startsWith(".") && isDirectory(path)) {
        walk(path, [...prefix, name]);
      }
    }
  };
  for (const root of roots.sources) walk(root, []);
  if (roots.std) walk(roots.std, ["std"]);
  return [...out].sort();
}

export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
