# Changelog

## 0.2.1

- A workspace that is a Jello checkout is checked with its own build, `vm/build/jelloc`, and its
  `stdlib`, ahead of an installed release, which may be too old for its sources.
- Windows: `jelloc.exe`, `jello.exe` and `jlo_tool.exe` are found, and so is a release in
  `%LOCALAPPDATA%\jello\current\bin`.

## 0.2.0

Rebuilt for the current language.

- Highlighting for every form in the docs:
  - `for`, `macro`, `??`, `#` comments and doc comments;
  - the `U8`–`U64` types and integer suffixes;
  - every escape, regexps with flags, and atoms (not mistaken for `{a:b}`);
  - bits and byte layouts, pins, `%` in pipelines;
  - ```` ```jello ```` blocks in Markdown.
- Snippets rewritten to current syntax. Each one is checked against the parser.
- Diagnostics from `jelloc` as you open and save. Errors in imported modules land in those files,
  and each error code links to its explanation.
- Completion:
  - module paths, imported names and namespace members;
  - enum variants, receiver methods and `this.` members;
  - types, atoms, locals and keywords.
- Hover with signatures, doc comments and the compiler's inferred types. Signature help,
  go to definition, document links, outline, workspace symbols, highlights and folding.
- Run File, Run Project, Build, Fetch Dependencies, New Project, and Show Tokens/HIR/IR/JLO.
  A `jello` task type, with problem matchers for compile errors and runtime traps.
- Test Explorer integration, with Run code lenses and expected/actual diffs.
- A schema for `jello.json`.
