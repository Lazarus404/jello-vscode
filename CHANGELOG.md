# Change Log

All notable changes to the "jello-lang" extension will be documented in this file.

## [0.1.0] - 2025-01-01

### Added

- Initial release of Jello language support for VSCode
- Syntax highlighting for:
  - Keywords (fn, if, else, while, for, match, try, catch, throw, using, etc.)
  - Control flow operators (break, continue, return)
  - Data types (null, true, false, numbers, strings, atoms, tuples, arrays, maps)
  - Operators (arithmetic, comparison, logical, bitwise, assignment, arrow, pipe)
  - Built-in namespaces (System, Actor, Promise, Random, Crypto, File, Net)
  - Built-in types (Object, Array, String, Binary, Tuple, Cell)
  - Comments (line comments with //)
  - Bitstrings (<% ... %> and << ... >>)
  - Pattern matching constructs
- Language configuration:
  - Auto-closing pairs for brackets, parentheses, braces, quotes, and bitstrings
  - Smart indentation rules
  - Comment toggling
  - Bracket matching
- Code snippets:
  - Functions (fn, fng)
  - Control flow (if, ife, while, for, match, try)
  - Actor system (actor, spawn, send, recv, recvs)
  - Data structures (map, arr, tup, bits, bin, enum)
  - Common utilities (print, assert, using, promise)
- Documentation:
  - Comprehensive README with language features and examples
  - Installation guide with multiple installation methods
  - Development setup instructions

### Technical Details

- Supports VSCode 1.70.0 and higher
- TextMate grammar for syntax highlighting
- Extension development host support for debugging

## Future Improvements

Planned features for future releases:

- [ ] IntelliSense and autocomplete
- [ ] Go to definition
- [ ] Find all references
- [ ] Hover documentation
- [ ] Diagnostics and linting
- [ ] Code formatting
- [ ] Refactoring support
- [ ] Debugger integration
- [ ] Symbol navigation
- [ ] Workspace symbol search
- [ ] Semantic token provider
- [ ] Call hierarchy
- [ ] Type hints
- [ ] Parameter hints
- [ ] Code actions (quick fixes)
- [ ] Task definitions for building/running Jello programs
- [ ] Testing framework integration
- [ ] REPL integration
- [ ] Theme customization examples
