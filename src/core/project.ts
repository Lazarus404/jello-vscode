// A Jello project: the nearest directory holding a jello.json (docs/07-tooling/03-projects.md).

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface Project {
  /** The directory holding jello.json, or the file's own directory when there is none. */
  dir: string;
  hasManifest: boolean;
  name: string;
  src: string;
  /** The entry module's file. */
  entry: string;
  testDirs: string[];
  /** Source directories of the packages the project depends on. */
  packageSrcs: string[];
}

interface Manifest {
  name?: unknown;
  entry?: unknown;
  src?: unknown;
  test?: { dirs?: unknown };
  dependencies?: unknown;
  package_paths?: unknown;
}

const readManifest = (dir: string): Manifest | undefined => {
  try {
    const value = JSON.parse(readFileSync(join(dir, "jello.json"), "utf8"));
    return value && typeof value === "object" ? (value as Manifest) : undefined;
  } catch {
    return undefined;
  }
};

const str = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;

/** The directory at or above `start` that holds a jello.json. */
export function findProjectDir(start: string): string | undefined {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "jello.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** The project for a file or directory. Outside any project, the directory stands alone. */
export function projectFor(path: string): Project {
  const start = isDirectory(path) ? path : dirname(path);
  const found = findProjectDir(start);
  const dir = found ?? resolve(start);
  const manifest = (found && readManifest(found)) || {};
  const src = resolve(dir, str(manifest.src, "src"));
  const name = str(manifest.name, dir.split(/[\\/]/).pop() ?? "main").replace(/[ /]/g, "-");
  const entry =
    typeof manifest.entry === "string" ? resolve(src, manifest.entry) : join(src, "Main.jello");
  const testDirs = (strings(manifest.test?.dirs) ?? ["tests"]).map((d) => resolve(dir, d));

  const deps =
    manifest.dependencies && typeof manifest.dependencies === "object"
      ? Object.keys(manifest.dependencies)
      : [];
  const holders = [
    join(dir, "packages"),
    ...(strings(manifest.package_paths) ?? []).map((p) => resolve(dir, p)),
  ];
  const packageSrcs: string[] = [];
  for (const dep of deps) {
    const home = holders.map((h) => join(h, dep)).find(isDirectory);
    if (!home) continue;
    const own = readManifest(home) ?? {};
    packageSrcs.push(resolve(home, str(own.src, "src")));
  }
  return { dir, hasManifest: found !== undefined, name, src, entry, testDirs, packageSrcs };
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
