# Jello Language Quick Reference

A quick reference guide for Jello syntax, designed for use with the VSCode extension.

## Table of Contents

- [Basic Syntax](#basic-syntax)
- [Data Types](#data-types)
- [Operators](#operators)
- [Control Flow](#control-flow)
- [Functions](#functions)
- [Pattern Matching](#pattern-matching)
- [Actors](#actors)
- [Snippets](#snippets)

## Basic Syntax

### Comments

```jello
// Single-line comment
```

### Variables

```jello
x := 42;          // Declare with :=
x = 43;           // Assign with =
```

### Constants

```jello
null              // Null value
true              // Boolean true
false             // Boolean false
```

## Data Types

### Numbers

```jello
42                // Integer
3.14              // Float
0xFF              // Hex
0b1010            // Binary
0o755             // Octal
1.5e10            // Scientific notation
```

### Strings

```jello
"Hello, World!"   // Double quotes
'Single quotes'   // Single quotes
"Escaped: \n \t"  // Escape sequences
```

### Atoms (Symbols)

```jello
:ok               // Atom
:error
:message_type
```

### Arrays

```jello
[]                // Empty array
[1, 2, 3]         // Array literal
[1, "two", :three] // Mixed types
```

### Tuples

```jello
()                // Empty tuple
(1, 2, 3)         // Tuple literal
(:Ok, 42)         // Tagged tuple (enum)
```

### Maps

```jello
%{}               // Empty map
%{x: 1, y: 2}     // Map literal
%{name: "Alice", age: 30}
```

### Bitstrings

```jello
<<1, 2, 3>>       // Binary literal
<% x::8, y::16 %> // Bitstring pattern
```

## Operators

### Arithmetic

```jello
a + b             // Addition
a - b             // Subtraction
a * b             // Multiplication
a / b             // Division
a % b             // Modulo
```

### Comparison

```jello
a == b            // Equal
a != b            // Not equal
a < b             // Less than
a > b             // Greater than
a <= b            // Less than or equal
a >= b            // Greater than or equal
```

### Logical

```jello
a && b            // Logical AND
a || b            // Logical OR
!a                // Logical NOT
```

### Bitwise

```jello
a & b             // Bitwise AND
a | b             // Bitwise OR
a << 2            // Left shift
a >> 2            // Right shift
~a                // Bitwise NOT
```

### Special

```jello
x := y            // Declaration
x = y             // Assignment
->                // Arrow (function result, match arm)
|>                // Pipe operator
...rest           // Spread operator
^x                // Pin operator (pattern matching)
```

## Control Flow

### If-Else

```jello
if (condition) {
    // then
} else {
    // else
}
```

### While

```jello
while (condition) {
    // body
}
```

### Break/Continue

```jello
break;            // Exit loop
continue;         // Skip to next iteration
```

### Try-Catch

```jello
try {
    // code that might throw
} catch (error) {
    // handle error
}
```

### Throw

```jello
throw "Error message";
throw (:Error, "Details");
```

## Functions

### Basic Function

```jello
add := fn(x, y) {
    return x + y;
};
```

### Function with Guard

```jello
positive := fn(x) if x > 0 {
    return x;
};
```

### Default Parameters

```jello
greet := fn(name, greeting := "Hello") {
    return greeting + ", " + name;
};
```

### Rest Parameters

```jello
sum := fn(first, ...rest) {
    // rest is an array
};
```

### Pattern Parameters

```jello
// Tuple destructuring
process := fn((x, y)) {
    return x + y;
};

// Array destructuring
first_elem := fn([head, ...tail]) {
    return head;
};
```

## Pattern Matching

### Match Expression

```jello
result := match value {
    | 0 -> "zero";
    | 1 -> "one";
    | n when n > 0 -> "positive";
    | _ -> "other";
};
```

### Destructuring

```jello
// Tuple
(x, y) := point;

// Array
[first, second, ...rest] := list;

// Map
%{name: n, age: a} = user;

// Tagged tuple
(:Ok, value) := result;
```

### Patterns

```jello
_                 // Wildcard (matches anything)
x                 // Variable binding
42                // Literal constant
:atom             // Atom literal
^x                // Pin (match existing value)
(a, b)            // Tuple pattern
[a, b, ...rest]   // Array pattern with rest
%{x: a, y: b}     // Map pattern
Tag(payload)     // Tagged tuple pattern
p1 | p2           // Or pattern
pattern as name   // As pattern
```

## Actors

### Define Actor

```jello
Actor := %{
    start: fn() {
        while (true) {
            msg := Actor.receive();
            // handle message
        }
    }
};
```

### Spawn Actor

```jello
pid := Actor.spawn(Actor);
```

### Send Message

```jello
Actor.send(pid, (:message, data));
```

### Receive Message

```jello
msg := Actor.receive();
```

### Selective Receive

```jello
msg := Actor.receive_select(fn(m) {
    return m.0 == :target;
});
```

### Actor Control

```jello
self := Actor.pid();          // Get current PID
alive := Actor.is_alive(pid); // Check if alive
Actor.exit(pid, :reason);     // Terminate actor
```

## Built-in Namespaces

### System

```jello
System.print(value);          // Print to console
System.println(value);        // Print with newline
System.assert(condition);     // Assert condition
```

### String

```jello
String.from_int(42);          // Convert to string
String.upper("hello");        // To uppercase
String.lower("WORLD");        // To lowercase
```

### Array

```jello
Array.push(arr, item);        // Add item
Array.length(arr);            // Get length
Array.slice(arr, start, end); // Slice array
Array.map(arr, fn);           // Map function
Array.filter(arr, fn);        // Filter array
```

### Object

```jello
Object.new();                 // Create object
Object.clone(obj);            // Clone object
```

### Crypto

```jello
Crypto.sha256(data);          // SHA-256 hash
Crypto.strongRandBytes(32);   // Random bytes
Crypto.aesGcmEncrypt(...);    // AES-GCM encrypt
```

### Random

```jello
Random.int(1, 100);           // Random integer
Random.float();               // Random float [0, 1)
```

## Snippets

Type these prefixes and press Tab to expand:

- `fn` → Function
- `fng` → Function with guard
- `if` → If statement
- `ife` → If-else statement
- `while` → While loop
- `for` → For loop
- `match` → Match block
- `try` → Try-catch
- `actor` → Actor protocol
- `spawn` → Spawn actor
- `send` → Send message
- `recv` → Receive message
- `print` → System.print()
- `assert` → System.assert()

## Common Patterns

### Request-Reply

```jello
// Sender
Actor.send(server, (:request, data, Actor.pid()));
reply := Actor.receive();

// Server
msg := Actor.receive();
sender := msg.2;
Actor.send(sender, (:reply, result));
```

### Error Handling

```jello
result := try {
    dangerous_operation();
} catch (e) {
    handle_error(e);
};
```

### Pipe Chain

```jello
result := data
    |> transform1
    |> transform2
    |> transform3;
```

### State Machine

```jello
state := :idle;
match (state, event) {
    | (:idle, :start) -> :running;
    | (:running, :stop) -> :idle;
    | (s, _) -> s;
}
```

## Tips

1. **Use atoms for message tags**: `(:increment)`, `(:get, sender)`
2. **Pattern match enums**: `(:Ok, value)`, `(:Err, error)`
3. **Leverage guards**: `fn(x) if x > 0 { ... }`
4. **Use the pipe operator**: `value |> function`
5. **Destructure in function params**: `fn((x, y)) { ... }`
6. **Use selective receive** for protocol handling
7. **Always provide `:stop` message** for actors
8. **Include sender PID** in requests for replies

## Resources

- Extension README: Full feature documentation
- test-syntax.jello: Comprehensive syntax examples
- ../docs/: Language implementation docs
- ../test/: Example programs

---

For more details, see the main README.md and INSTALL.md files.
