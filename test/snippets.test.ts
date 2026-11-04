// Every snippet, expanded with its placeholders' defaults and set where it belongs, must parse.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { jelloc, needsJelloc } from "./support";

/** Where a snippet that is not a whole statement goes; `$$` is the snippet. */
const CONTEXT: Record<string, string> = {
  lambda: "let f = $$;",
  "method function": "let m = $$;",
  parameters: "let f = $$;",
  "else if": "if (true) { 1; } $$",
  "match arm with guard": "match (1) { $$ _ => 0 }",
  return: "let f = fn(): I32 { $$ };",
  "let else": "let f = fn(xs: Array<I32>): I32 { $$ 0 };",
  new: "let o = $$;",
  quote: "macro m(x) { $$; }",
  unquote: "macro m(x) { quote.expr { $$ }; }",
  list: "let l = $$;",
  comprehension: "let l = $$;",
  bits: "let b = $$;",
  pipeline: "let p = $$;",
  regexp: "let r = $$;",
  template: "let t = $$;",
  string: "let s = $$;",
  "doc comment": "$$\nlet x = 1;",
  subtest: "let testA = fn(t: Test) { $$ };",
};

/** A snippet body with each placeholder at its default, each choice at its first option. */
export function expand(body: string): string {
  let out = body;
  for (let i = 0; i < 10; i++) {
    const next = out
      .replace(/\$\{\d+\|([^,|]*)[^|]*\|\}/g, "$1")
      .replace(/\$\{\d+:((?:[^{}\\]|\\.)*)\}/g, "$1")
      .replace(/\$\{\d+\}|\$\d+/g, "");
    if (next === out) break;
    out = next;
  }
  return out.replace(/\\\$/g, "$").replace(/\\}/g, "}");
}

test("placeholders expand to their defaults", () => {
  assert.equal(expand("let ${1:name} = ${0:value};"), "let name = value;");
  assert.equal(expand("quote.${1|expr,stmt|} { $0 }"), "quote.expr {  }");
  assert.equal(expand("`${1:text} \\${${2:value}}`"), "`text ${value}`");
});

test("every snippet parses where it belongs", needsJelloc, () => {
  const snippets = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "snippets", "jello.code-snippets"), "utf8"),
  ) as Record<string, { body: string[] }>;
  const dir = mkdtempSync(join(tmpdir(), "jello-snippets-"));
  const failures: string[] = [];
  for (const [name, snippet] of Object.entries(snippets)) {
    const code = expand(snippet.body.join("\n"));
    const program = (CONTEXT[name] ?? "$$").replace("$$", () => code);
    const file = join(dir, `${name.replace(/\W+/g, "_")}.jello`);
    writeFileSync(file, program + "\n");
    const result = spawnSync(jelloc!, [file, "--parse"], { encoding: "utf8" });
    if (result.status !== 0) failures.push(`${name}:\n${program}\n${result.stderr}`);
  }
  assert.deepEqual(failures, []);
});
