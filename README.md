# Jello Language Support for VSCode

Syntax highlighting and language support for the [Jello programming language](https://github.com/yourusername/jello-lang).

## Features

- **Syntax Highlighting**: Full syntax highlighting for Jello source files (`.jello`)
- **Bracket Matching**: Auto-closing and matching for brackets, parentheses, and braces
- **Comment Support**: Line comments with `//`
- **Smart Indentation**: Automatic indentation based on code structure

## Supported Language Features

### Keywords
- **Control Flow**: `if`, `else`, `while`, `for`, `break`, `continue`, `return`
- **Pattern Matching**: `match`, `as`
- **Exception Handling**: `try`, `catch`, `throw`
- **Functions**: `fn`
- **Modules**: `using`
- **Context**: `this`

### Data Types
- **Primitives**: `null`, `true`, `false`
- **Numbers**: Integers, floats, hex (`0x`), binary (`0b`), octal (`0o`)
- **Strings**: Double-quoted and single-quoted strings with escape sequences
- **Atoms**: Symbolic constants prefixed with `:` (e.g., `:ok`, `:error`)
- **Tuples**: `(a, b, c)`
- **Arrays**: `[1, 2, 3]`
- **Maps**: `%{key: value}`
- **Bitstrings**: `<% x::8, y::16 %>` and `<<1, 2, 3>>`

### Operators
- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **Comparison**: `==`, `!=`, `<`, `>`, `<=`, `>=`
- **Logical**: `&&`, `||`, `!`
- **Bitwise**: `&`, `|`, `<<`, `>>`, `~`
- **Assignment**: `:=` (declare), `=` (assign)
- **Special**: `->` (arrow), `|>` (pipe), `...` (spread), `^` (pin)

### Built-in Namespaces
- **System**: System operations (`System.print`, `System.assert`)
- **Actor**: Concurrency primitives (`Actor.spawn`, `Actor.send`, `Actor.receive`)
- **Promise**: Async operations
- **Random**: Random number generation
- **Crypto**: Cryptographic functions
- **File**: File I/O
- **Net**: Network operations

### Built-in Types
- `Object`, `Array`, `String`, `Binary`, `Tuple`, `Cell`

## Installation

### From Source

1. Copy the `vscode` directory to your VSCode extensions folder:
   - **macOS/Linux**: `~/.vscode/extensions/jello-lang-0.1.0/`
   - **Windows**: `%USERPROFILE%\.vscode\extensions\jello-lang-0.1.0\`

2. Reload VSCode

### Development

To work on this extension:

1. Open the `vscode` folder in VSCode
2. Press `F5` to launch a new Extension Development Host window
3. Open a `.jello` file to test the syntax highlighting

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
    | :Ok(x) -> x
    | :Err(e) -> 0
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

For more information about the Jello language, see the [documentation](../docs/).

## Contributing

Contributions are welcome! Please submit issues and pull requests to the [main repository](https://github.com/yourusername/jello-lang).

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Release Notes

### 0.1.0

- Initial release
- Syntax highlighting for all language constructs
- Bracket matching and auto-closing
- Comment support
- Smart indentation

