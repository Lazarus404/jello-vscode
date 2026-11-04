// What the tests share: where the repository and a jelloc are.

import { accessSync, constants } from "node:fs";
import { delimiter, join, resolve } from "node:path";

export const repo = resolve(__dirname, "..", "..", "..");
export const std = join(repo, "stdlib");

const executable = (path: string) => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** A jelloc to test against: $JELLOC, the repository's own build, or one on PATH. */
export const jelloc: string | undefined = [
  process.env.JELLOC,
  join(repo, "vm", "build", "jelloc"),
  ...(process.env.PATH ?? "").split(delimiter).map((d) => join(d, "jelloc")),
].find((p): p is string => !!p && executable(p));

export const needsJelloc = jelloc ? {} : { skip: "no jelloc found; set JELLOC" };
