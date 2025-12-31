# Contributing to Jello VSCode Extension

Thank you for your interest in contributing to the Jello language extension for Visual Studio Code!

## Getting Started

### Prerequisites

- Visual Studio Code 1.70.0 or higher
- Node.js and npm
- Git
- Basic understanding of TextMate grammars and VSCode extension development

### Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Lazarus404/jello-vscode.git
   cd jello-vscode
   ```

2. **Open in VSCode:**

   ```bash
   code .
   ```

3. **Press F5 to launch Extension Development Host**
   - This opens a new VSCode window with the extension loaded
   - Test your changes by opening `.jello` files in the test directory

## Project Structure

```
vscode/
├── .vscode/
│   └── launch.json          # Debug configuration
├── snippets/
│   └── jello.json           # Code snippets
├── syntaxes/
│   └── jello.tmLanguage.json # TextMate grammar
├── CHANGELOG.md              # Version history
├── CONTRIBUTING.md           # This file
├── INSTALL.md                # Installation instructions
├── language-configuration.json # Language features config
├── package.json              # Extension manifest
├── README.md                 # Extension documentation
└── test-syntax.jello         # Syntax highlighting test file
```

## How to Contribute

### Reporting Bugs

If you find a bug in the syntax highlighting or language features:

1. Check if the issue already exists in the [issue tracker](https://github.com/lazarus404/jello-lang/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Code sample demonstrating the issue
   - VSCode version and extension version

### Suggesting Enhancements

We welcome suggestions for improvements:

1. Check existing issues for similar suggestions
2. Create a new issue with:
   - Clear description of the enhancement
   - Use cases and benefits
   - Examples of how it would work
   - Any relevant screenshots or mockups

### Contributing Code

#### Improving Syntax Highlighting

The syntax highlighting is defined in `syntaxes/jello.tmLanguage.json` using TextMate grammar:

1. **Edit the grammar file**

   - Add or modify patterns in the `repository` section
   - Update the main `patterns` array if needed
   - Test changes by pressing F5

2. **Test thoroughly**

   - Open `test-syntax.jello` in the Extension Development Host
   - Verify all language constructs are highlighted correctly
   - Test edge cases and complex nested structures

3. **Document your changes**
   - Update CHANGELOG.md
   - Add examples to test-syntax.jello if needed

#### Adding Snippets

Snippets are defined in `snippets/jello.json`:

1. **Add a new snippet:**

   ```json
   "Snippet Name": {
     "prefix": "trigger",
     "body": [
       "line 1",
       "line 2 with ${1:placeholder}"
     ],
     "description": "What this snippet does"
   }
   ```

2. **Use placeholders:**

   - `${1:default}` - First tab stop with default text
   - `${2}` - Second tab stop
   - `$0` - Final cursor position

3. **Test the snippet:**
   - Type the prefix in a `.jello` file
   - Press Tab to expand
   - Verify placeholders and tab order

#### Updating Language Configuration

The file `language-configuration.json` defines:

- Comment styles
- Bracket pairs
- Auto-closing pairs
- Indentation rules

Changes here affect editor behavior for `.jello` files.

#### Improving Documentation

Documentation improvements are always welcome:

- Fix typos or unclear explanations
- Add more examples
- Improve installation instructions
- Create tutorials or guides

### Pull Request Process

1. **Fork the repository**

2. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes:**

   - Follow existing code style and patterns
   - Test thoroughly
   - Update documentation

4. **Commit your changes:**

   ```bash
   git commit -m "Description of changes"
   ```

   Use clear, descriptive commit messages.

5. **Push to your fork:**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request:**

   - Provide a clear description of changes
   - Reference any related issues
   - Include screenshots if relevant
   - Explain testing performed

7. **Address review feedback:**
   - Respond to comments
   - Make requested changes
   - Update the PR

## TextMate Grammar Reference

The syntax highlighting uses TextMate grammar scopes:

### Common Scopes

- `keyword.control` - Control flow keywords (if, while, etc.)
- `keyword.operator` - Operators (+, -, ==, etc.)
- `constant.numeric` - Numbers
- `constant.language` - Language constants (true, false, null)
- `string.quoted` - String literals
- `comment.line` - Line comments
- `entity.name.function` - Function names
- `support.function` - Built-in functions
- `support.class` - Built-in classes/namespaces
- `variable.language` - Special variables (this)

### Testing Patterns

Test your regex patterns with care:

- Use online regex testers
- Test edge cases
- Avoid overly greedy patterns
- Consider performance implications

### Pattern Priority

Patterns are matched in order:

1. Earlier patterns take precedence
2. Use `begin`/`end` for multi-line constructs
3. Use `match` for single-line patterns
4. Nest patterns with `include`

## Style Guidelines

### Code Style

- Use 2 spaces for indentation in JSON files
- Keep regex patterns readable with clear capture groups
- Add comments for complex patterns
- Group related patterns together

### Documentation Style

- Use clear, concise language
- Include code examples
- Format code with proper syntax highlighting
- Use bullet points for lists
- Keep line length reasonable

## Resources

### VSCode Extension Development

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Language Extensions Guide](https://code.visualstudio.com/api/language-extensions/overview)
- [Syntax Highlighting Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)

### TextMate Grammars

- [TextMate Language Grammars](https://macromates.com/manual/en/language_grammars)
- [VSCode TextMate Grammar](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#textmate-grammars)
- [Scope Naming Conventions](https://www.sublimetext.com/docs/scope_naming.html)

### Testing Tools

- [Regex101](https://regex101.com/) - Test regex patterns
- [VSCode Grammar Inspector](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#scope-inspector) - Inspect token scopes

## Questions?

If you have questions about contributing:

- Open an issue with the `question` label
- Check existing documentation
- Look at similar VSCode language extensions

## Code of Conduct

Be respectful and constructive in all interactions. We aim to maintain a welcoming and inclusive community.

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (MIT License).

## Thank You!

Your contributions help make the Jello language and its tooling better for everyone!
