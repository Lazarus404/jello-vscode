// Where the Jello tools may be, in the order they are preferred.

import { posix, win32 } from "node:path";

/** A place jelloc may be, with the std library that goes with it when only that one will do. */
export interface Candidate {
  jelloc: string;
  std?: string;
}

export interface Search {
  /** The jello.jelloc.path setting, expanded; empty when it is not set. */
  configured: string;
  /** The workspace folders. */
  folders: string[];
  env: { JELLO_ROOT?: string; PATH?: string; LOCALAPPDATA?: string };
  home: string;
  platform: NodeJS.Platform;
}

/** The file name of a tool such as jelloc on `platform`. */
export const toolName = (name: string, platform: NodeJS.Platform) =>
  platform === "win32" ? `${name}.exe` : name;

/**
 * The places jelloc may be, most preferred first: the setting alone when it is set; else a
 * workspace that is a Jello checkout, whose own build and std its sources need, as an installed
 * release may be older than they are; then `$JELLO_ROOT/bin`, `PATH`, and the installed release.
 */
export function candidates(search: Search): Candidate[] {
  const path = search.platform === "win32" ? win32 : posix;
  const jelloc = toolName("jelloc", search.platform);
  if (search.configured) return [{ jelloc: search.configured }];
  const installed = [path.join(search.home, ".jello", "current", "bin")];
  if (search.platform === "win32" && search.env.LOCALAPPDATA) {
    installed.push(path.join(search.env.LOCALAPPDATA, "jello", "current", "bin"));
  }
  return [
    ...search.folders.map((f) => ({
      jelloc: path.join(f, "vm", "build", jelloc),
      std: path.join(f, "stdlib"),
    })),
    ...[
      ...(search.env.JELLO_ROOT ? [path.join(search.env.JELLO_ROOT, "bin")] : []),
      ...(search.env.PATH ?? "").split(path.delimiter).filter(Boolean),
      // VS Code started from the Dock does not see a login shell's PATH.
      ...installed,
    ].map((dir) => ({ jelloc: path.join(dir, jelloc) })),
  ];
}
