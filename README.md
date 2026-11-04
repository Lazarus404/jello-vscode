# Jello for VS Code

Language support for Jello, a prototypal, functional language with a register VM.
The extension asks `jelloc` for anything only the compiler knows, so its errors and types are the
compiler's own, and there is no language server to fall out of step with the language.

## Features

**Editing**
- **Highlighting** for every form in the language reference, including:
  - templates with `${...}` holes, regexps with flags, and atoms;
  - `bits[...]` segments and `bytes-layout` typedefs;
  - doc comments with `@param` tags, pins, and the `%` of a pipeline.

  ```` ```jello ```` blocks in Markdown are highlighted too.
- **Snippets** for current syntax, each one tested against the parser. They cover:
  - functions, generics and `method fn`;
  - `for`, `if let`, `while let`, `let ... else`, `match` with guards, `with`, and `try`;
  - enums, records, linked typedefs and prototypes, and byte layouts;
  - imports, macros and quotes, comprehensions, `bits`, and tests.
- **Bracket colouring, folding** (blocks, doc comments, imports, `// #region`), comment toggling
  and doc-comment continuation.

**Understanding code**
- **Diagnostics** straight from `jelloc`, when you open and when you save.
  - An error in an imported module shows in that module.
  - Each error code links to `jelloc --explain`, and a quick fix offers the same.
  - With `jello.check.onType` on, checks also run as you type.
- **Completion**:
  - module paths after `from`, `import` and `package`;
  - the names a module exports, inside `import { ... }`;
  - members of built-in namespaces (`Math.`, `Std.`), of import aliases (`T.` for
    `import std.testing as T`) and of enums;
  - methods of a value's type, from the compiler's inferred types where it has them, and `this.`
    inside a prototype;
  - types, atoms, locals, top-level names and keywords.
- **Hover**:
  - signatures and doc comments for your declarations, for std modules and for built-ins;
  - a short note on each keyword, linked to the reference when the docs are on this machine;
  - the compiler's inferred type of any name, after a clean check.
- **Navigation**: signature help, go to definition (into std too), clickable import paths, an
  outline with variants, fields and methods, workspace symbols, and highlights of the name under
  the cursor.

**Running and testing**
- **Run and build**:
  - Run File and Run Project, also from the editor's run button;
  - Build, and Fetch Dependencies;
  - New Project, which runs `jlo_tool init`;
  - a `jello` task type, with problem matchers for compile errors (`$jelloc`) and runtime traps
    (`$jello-trap`).
- **Testing**: every `let testName = fn(t: Test)` in a `*.test.jello` file appears in the Test
  Explorer.
  - Run any test, file or all of them, from the explorer or from the code lenses.
  - Failures point at the assertion, with an expected/actual diff.
  - Subtests appear as they run.
- **Listings**: Show Tokens, HIR, IR or JLO for the current file. Each opens beside it and
  refreshes on save, for seeing what the compiler makes of your code.
- **`jello.json`** is validated and completed from a schema.

## Finding the toolchain

`jelloc` is found from, in order:
1. `jello.jelloc.path`;
2. a workspace that is a Jello checkout: its own build, `vm/build`, with its `stdlib`, as its
   sources may use what an installed release is too old for;
3. `$JELLO_ROOT/bin`;
4. `PATH`;
5. `~/.jello/current/bin`, where `install.sh` puts it, or on Windows also
   `%LOCALAPPDATA%\jello\current\bin`.

`jello` and `jlo_tool` are found beside it (with `.exe` on Windows). The standard library comes
from `jello.std.path`, then a checkout's `stdlib`, then `JELLO_STD_PATH`, then `std` beside the
toolchain, then a workspace's `stdlib`. The status
bar shows what was found; click it to choose another `jelloc`.

Without `jelloc`, highlighting, snippets, completion, outline and navigation still work.
Diagnostics, inferred types, running and testing need it.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `jello.jelloc.path` | `""` | `jelloc` to use; empty searches as above |
| `jello.std.path` | `""` | the standard library directory |
| `jello.paths` | `[]` | extra source roots, passed as `--path` |
| `jello.check.onSave` | `true` | check on open and save |
| `jello.check.onType` | `false` | also check while typing, from a copy of the buffer |
| `jello.check.timeoutMs` | `10000` | how long a compile may take |
| `jello.hoverTypes` | `true` | show the compiler's inferred types on hover |
| `jello.codeLens` | `true` | Run lenses above tests |

## Developing

```bash
cd jellovs
npm install
npm test             # drift check, grammar sweep, unit tests, grammar snapshots
npm run integration  # the features, driven through an installed VS Code ($VSCODE_PATH)
npm run format       # Prettier, at 100 columns
npm run package      # jello-language-<version>.vsix
```

Press F5 in VS Code to start an Extension Development Host.

- **The grammar** lives in `syntaxes/jello.grammar.mjs` and is built into
  `jello.tmLanguage.json` by `node scripts/build-grammar.mjs`.
- **The data:** `npm run gen` rebuilds `data/builtins.json` from the docs.
- **What `npm test` fails on:**
  - the grammar, tokenizer or hover data disagreeing with the compiler's lexer and checker;
  - built-ins the docs don't list, or `std.testing` assertions the extension doesn't know;
  - a source in the repository that the grammar leaves unbalanced;
  - a snippet that doesn't parse;
  - a change in the compiler's diagnostic or listing format.

## License

BSD-3-Clause
