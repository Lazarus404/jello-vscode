# Jello Language Support for VSCode

Comprehensive language support for the Jello programming language, including syntax highlighting and full-featured debugging.

## Features

### Language Support

- **Syntax Highlighting**: Full syntax highlighting for Jello source files (`.jello`)
- **Bracket Matching**: Auto-closing and matching for brackets, parentheses, and braces
- **Comment Support**: Line comments with `//` and block comments
- **Smart Indentation**: Automatic indentation based on code structure
- **Code Folding**: Fold functions, blocks, and other structures

### Debugger

Full Debug Adapter Protocol (DAP) integration with comprehensive debugging features:

**Core Features**:

- **Breakpoints**: Line breakpoints with stable IDs, per-file management
- **Advanced Breakpoints**: Conditional breakpoints (`pc == 100`), hit counts, logpoints
- **Stepping**: Step over, step into, step out with accurate line-level behavior
- **Variables**: Inspect locals, globals, and VM internals with lazy expansion
  - Frame-accurate inspection (any stack depth, any thread)
  - Upvalues and cell-captured variables
  - Paging support for large collections (max 1000 items)
- **Watch Expressions**: Evaluate safe read-only expressions (`self.field[0]`, `this` alias)
- **Stack Traces**: View call stacks with source mapping for all frames
- **Exception Breakpoints**: Stop on all/uncaught exceptions with detailed exception info
- **Multi-Actor Debugging**: Debug concurrent actor programs with per-actor or coordinated pause modes
- **Hover Evaluation**: See variable values on hover while debugging
- **Source Mapping**: Accurate bytecode to source location mapping via debug info
- **Security**: Input validation, bounds checking, recursion limits

**Performance**:

- Zero overhead when not debugging
- <1ms breakpoint hit latency
- Bounded operations (no unbounded allocations)

**VS Code Settings**:

- `jello.debugger.pauseAllActors`: Coordinate actor pausing (default: false)
- `jello.debugger.exceptionBreakpoints`: Exception pause mode (never/uncaught/all)
- `jello.debugger.jelloPath`, `jellocPath`, `jelloLibPath`: Binary and library paths

See [DEBUGGER.md](./DEBUGGER.md) for comprehensive debugging documentation and troubleshooting.

## Supported Language Features

### Keywords

- **Control Flow**: `if`, `else`, `do`, `while`, `break`, `continue`, `return`
- **Pattern Matching**: `match`, `as`
- **Exception Handling**: `try`, `catch`, `throw`
- **Functions**: `fn`
- **Modules**: `using`, `import`, `from`
- **Context**: `this`

### Data Types

- **Primitives**: `null`, `true`, `false`
- **Numbers**: Integers, floats, hex (`0x`), binary (`0b`), octal (`0o`)
- **Strings**: Double-quoted and single-quoted strings with escape sequences
- **Atoms**: Symbolic constants prefixed with `:` (e.g., `:ok`, `:error`)
- **Tuples**: `(a, b, c)`
- **Arrays**: `[1, 2, 3]`
- **Objects**: `%{key: value}` or `%{"field1" => value1, "field2" => value2}`
- **Bitstrings**: `<% x::8, y::16 %>` pattern matching, `<%1, 2, 3%>` literals

### Operators

- **Arithmetic**: `+`, `-`, `*`, `/`, `%`, `**`
- **Comparison**: `==`, `!=`, `<`, `>`, `<=`, `>=`
- **Logical**: `&&`, `||`, `!`
- **Bitwise**: `&`, `|`, `<<`, `>>`, `~`, `^`
- **Assignment**: `:=` (declare), `=` (assign/reassign)
- **Special**: `->` (arrow), `|>` (pipe), `...` (spread), `^` (pin)
- **Match**: `~=` (pattern match operator)

### Built-in Namespaces

- **System**: System operations (`System.print`, `System.args`, `System.assert`)
- **Actor**: Concurrency primitives (`Actor.spawn`, `Actor.send`, `Actor.receive`)
- **Promise**: Async operations
- **Random**: Random number generation
- **Crypto**: Cryptographic functions
- **File**: File I/O
- **Net**: Network operations
- **Buffer**: Binary data manipulation
- **Math**: Mathematical functions

### Built-in Types

- `Object`, `Array`, `String`, `Binary`, `Tuple`, `Actor`, `Promise`

## Installation

### From Source

1. Copy the `jello-vscode` directory to your VSCode extensions folder:

   - **macOS/Linux**: `~/.vscode/extensions/jello-lang/`
   - **Windows**: `%USERPROFILE%\.vscode\extensions\jello-lang\`

2. Reload VSCode

### Development

To work on this extension:

1. Open the `jello-vscode` folder in VSCode
2. Press `F5` to launch an Extension Development Host window
3. Open a `.jello` file to test the syntax highlighting

## Debugging (DAP stdio)

This extension can launch the Jello VM as a DAP stdio debug adapter.

### Requirements

- Jello VM supports `-debugger` and auto-starts the DAP server on stdio.
- `debug.jdll` is discoverable via `JELLO_PATH` (default setting uses `${workspaceFolder}/libs`).

### Launch configuration example

Add this to your workspace `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "jello",
      "request": "launch",
      "name": "Debug Jello",
      "program": "${file}"
    }
  ]
}
```

Notes:

- `program` can be a `.jello` file (it will run `jelloc` first) or a `.jlo`.
- Configure binaries via settings:
  - `jello.debugger.jelloPath`
  - `jello.debugger.jellocPath`
  - `jello.debugger.jelloLibPath`

## Examples

### Function Definition

```jello
add := fn(x, y) {
    return x + y
};
```

### Pattern Matching

```jello
result := match value {
    | :ok(x) -> x
    | :error(e) -> 0
};
```

### Actor System

```jello
Counter := %{
    start: fn() {
        count := 0;
        while (true) {
            msg := Actor.receive();
            if (msg.0 == :increment) {
                count = count + 1;
            }
        }
    }
};

pid := Actor.spawn(Counter);
Actor.send(pid, (:increment));
```

### Bitstring Pattern Matching

```jello
<% x::8, y::16 %> = <<1, 2, 3>>;
System.print(x);  // 1
System.print(y);  // 515 (0x0203)
```

## Language Documentation

For more information about the Jello language, see the documentation.

## Contributing

Contributions are welcome! Please submit issues and pull requests to the main repository.

## License

MIT License - see LICENSE for details.

## Release Notes

### 0.1.0

- Initial release
- Syntax highlighting for all language constructs
- Bracket matching and auto-closing
- Comment support
- Smart indentation
- Debugger: Full DAP implementation with breakpoints, stepping, variables, exceptions
- Advanced breakpoints: Conditional, hit counts, logpoints
- Frame-accurate variable inspection with upvalues and paging
- Exception breakpoints with detailed exception info
- Multi-actor debugging with configurable pause modes
- Security hardening: Input validation, bounds checking, recursion limits
- Comprehensive troubleshooting guide in DEBUGGER.md
- See CHANGELOG.md for complete feature list
