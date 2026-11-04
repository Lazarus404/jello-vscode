// The diagnostic parser against what the real compiler prints for the e2e error fixtures.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { parseCompilerOutput } from "../src/core/diagnostics";
import { jelloc, needsJelloc, repo, std } from "./support";

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".jello")) out.push(path);
  }
  return out;
};

test("compile errors read back as the fixtures expect", needsJelloc, () => {
  const fixtures = walk(join(repo, "jelloc", "tests", "e2e", "programs"))
    .filter((f) => {
      const text = readFileSync(f, "utf8");
      return (
        /^\/\/ error: \d+:\d+: /m.test(text) &&
        !/^\/\/ (flags|args|process|schedulers):/m.test(text)
      );
    })
    .sort();
  assert.ok(fixtures.length >= 20, "too few error fixtures found");
  const failures: string[] = [];
  for (const file of fixtures) {
    const want = [...readFileSync(file, "utf8").matchAll(/^\/\/ error: (\d+):(\d+): (.*)$/gm)]
      .filter((m) => !m[3].startsWith("note: "))
      .map((m) => `${m[1]}:${m[2]}: ${m[3]}`.replaceAll("$DIR", dirname(file)));
    const result = spawnSync(jelloc!, [file, "--std", std, "--out", "/dev/null"], {
      encoding: "utf8",
    });
    const got = parseCompilerOutput(result.stderr)
      .diagnostics.filter((d) => d.file === file)
      .map(
        (d) =>
          `${d.line}:${d.column}: ${d.severity === "warning" ? "warning: " : ""}${d.message}${d.code ? ` [${d.code}]` : ""}`,
      );
    // A fixture expects a prefix of the message, and may leave the code out.
    const seen = (w: string) => got.some((g) => g.startsWith(w));
    for (const w of want)
      if (!seen(w)) failures.push(`${file}\n  want ${w}\n  got  ${got.join("\n       ")}`);
  }
  assert.deepEqual(failures, []);
});
