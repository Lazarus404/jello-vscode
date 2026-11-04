// Loads the Jello grammar into vscode-textmate, for the sweep and for eyeballing scopes.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vsctm from "vscode-textmate";
import oniguruma from "vscode-oniguruma";

const require = createRequire(import.meta.url);
const here = (path) => fileURLToPath(new URL(path, import.meta.url));

/** A grammar for source.jello, ready to tokenise. */
export async function loadGrammar() {
  const wasm = readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")).buffer;
  await oniguruma.loadWASM(wasm);
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (text) => new oniguruma.OnigString(text),
    }),
    loadGrammar: async (scope) =>
      scope === "source.jello"
        ? vsctm.parseRawGrammar(
            readFileSync(here("../syntaxes/jello.tmLanguage.json"), "utf8"),
            "jello.tmLanguage.json",
          )
        : null,
  });
  return registry.loadGrammar("source.jello");
}

/** Each line's tokens, as { line, text, scopes, ruleStackDepth after the line }. */
export function tokenise(grammar, source) {
  let stack = vsctm.INITIAL;
  const out = [];
  source.split(/\r?\n/).forEach((text, line) => {
    const result = grammar.tokenizeLine(text, stack);
    for (const token of result.tokens) {
      out.push({ line, text: text.slice(token.startIndex, token.endIndex), scopes: token.scopes });
    }
    stack = result.ruleStack;
    out.push({ line, end: true, depth: stack.depth });
  });
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const grammar = await loadGrammar();
  const source = readFileSync(process.argv[2], "utf8");
  for (const t of tokenise(grammar, source)) {
    if (t.end || t.text.trim() === "") continue;
    console.log(`${t.line + 1}\t${JSON.stringify(t.text)}\t${t.scopes.slice(1).join(" ")}`);
  }
}
