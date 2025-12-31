# Change Log

All notable changes to the "jello-lang" extension will be documented in this file.

## [0.1.0] - 2026-01-15

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
- Full Debug Adapter Protocol (DAP) implementation with comprehensive features:
  - Breakpoints**:
    - Line breakpoints with stable IDs and per-file management
    - Conditional breakpoints (e.g., `pc == 100`, `hitCount == 5`)
    - Hit count breakpoints (stop on Nth hit)
    - Logpoints (print without stopping)
  - Stepping:
    - Step Over (F10), Step Into (F11), Step Out (Shift+F11)
    - Accurate line-level stepping with temporary breakpoints
    - Step filtering for clean source-level debugging
  - Variable Inspection:
    - Locals, Globals, and Internals scopes
    - Frame-accurate variable inspection (any stack depth)
    - Named locals with PC-based lifetimes
    - Upvalues and cell-captured variables
    - Lazy expansion of arrays, tuples, objects with paging support
    - Variables paging (`start`/`count`) for large collections (max 1000 items)
  - Expression Evaluation:
    - Safe read-only expression evaluator for Watch pane
    - Supports: `self.field[0]`, `r0`, `g[42]`, object field access
    - `this` alias for `self`
    - String literal indexing for objects (e.g., `obj["field"]`)
    - Chain depth limit (50 levels) for safety
  - Exception Handling:
    - Exception breakpoints (never/uncaught/all modes)
    - Configurable via VS Code settings: `jello.debugger.exceptionBreakpoints`
    - ExceptionInfo request shows detailed exception type and message
    - Pause on throw (all mode) or uncaught (default mode)
  - Multi-Actor Debugging:
    - Actor-aware debugging (each actor = separate thread)
    - Per-actor or coordinated pause modes
    - Setting: `jello.debugger.pauseAllActors`
    - Stable thread IDs across debug sessions
  - Security & Hardening:
    - Input validation for all DAP parameters
    - Bounds checking (frameIndex ≤ 64, threadId ≤ 10K, count ≤ 1000)
    - Recursion limits in expression evaluator
    - No unbounded allocations or DoS vulnerabilities
  - Performance:
    - Zero overhead when debugger is not attached
    - <1ms breakpoint hit latency
    - Bounded operations (paging, chain depth limits)

### Technical Details

- Supports VSCode 1.70.0 and higher
- TextMate grammar for syntax highlighting
- Extension development host support for debugging
- DAP adapter implemented in `debug.jdll` (loaded by VM on `-debugger` flag)
- Bytecode patching for zero-overhead breakpoints
- Three-thread architecture (VM, DAP reader, watch thread)
- Comprehensive test coverage (12 e2e tests)

## Future Improvements

Planned features for future releases:

- [ ] IntelliSense and autocomplete
- [ ] Go to definition
- [ ] Find all references
- [ ] Hover documentation (outside debugger)
- [ ] Diagnostics and linting
- [ ] Code formatting
- [ ] Refactoring support
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