# 🎉 Jello VSCode Extension - Start Here!

Welcome to the Jello language extension for Visual Studio Code! This file will help you get started quickly.

## ⚡ Quick Start (3 Steps)

### 1. Install the Extension

**Easiest Method** (Using the install script - supports both Cursor and VSCode):

```bash
# From the vscode directory:
./install.sh
```

**Or manually:**

```bash
# For Cursor:
cp -r vscode ~/.cursor/extensions/jello-lang-0.1.0/

# For VSCode:
cp -r vscode ~/.vscode/extensions/jello-lang-0.1.0/
```

> **Note for Cursor Users:** Cursor uses `~/.cursor/extensions`, not `~/.vscode/extensions`. The install script now detects this automatically!

### 2. Reload VSCode

- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type "Reload Window"
- Press Enter

### 3. Test It!

Open any `.jello` file and you should see:

- ✅ Syntax highlighting
- ✅ "Jello" in the language mode (bottom-right corner)
- ✅ Auto-closing brackets
- ✅ Code snippets (type `fn` and press Tab)

## 📚 What You Get

### Syntax Highlighting

All Jello language features are highlighted:

- Keywords, operators, control flow
- Numbers, strings, atoms (`:ok`, `:error`)
- Data structures (arrays, tuples, maps, bitstrings)
- Built-in namespaces (System, Actor, Crypto, etc.)
- Comments

### Code Snippets

Type these and press Tab:

- `fn` → Function
- `match` → Match block
- `actor` → Actor protocol
- `if`, `while`, `for` → Control flow
- `print`, `assert` → Common functions

### Smart Editing

- Auto-close brackets, quotes, and bitstrings
- Comment toggling with `Cmd+/` or `Ctrl+/`
- Smart indentation
- Bracket matching

## 📖 Documentation

We've created comprehensive documentation for you:

| File                     | Description                                    |
| ------------------------ | ---------------------------------------------- |
| **INSTALL.md**           | Detailed installation instructions (3 methods) |
| **README.md**            | Full feature documentation and examples        |
| **QUICK_REFERENCE.md**   | Language syntax quick reference                |
| **EXTENSION_SUMMARY.md** | Complete overview of what was created          |
| **CONTRIBUTING.md**      | How to contribute to the extension             |
| **THEMES.md**            | Customize colors for Jello code                |
| **CHANGELOG.md**         | Version history and roadmap                    |

## 🎨 Try the Test File

Open `test-syntax.jello` to see all language features with syntax highlighting:

```bash
code vscode/test-syntax.jello
```

This file demonstrates:

- All data types and operators
- Functions and closures
- Pattern matching
- Actor system
- Control flow
- And much more!

## 🚀 Common Tasks

### Create a Function

1. Type `fn` and press Tab
2. Fill in the parameters
3. Add your code
4. Done!

### Create an Actor

1. Type `actor` and press Tab
2. Define message handling
3. Type `spawn` and press Tab to spawn it

### Pattern Matching

1. Type `match` and press Tab
2. Fill in the value to match
3. Add patterns and results

## 🎯 Next Steps

### For Users

1. ✅ Install the extension (you may have done this)
2. 📖 Read **QUICK_REFERENCE.md** for language syntax
3. 🎨 Check out **THEMES.md** to customize colors
4. 💻 Start coding in Jello!

### For Developers

1. 📖 Read **CONTRIBUTING.md** for development setup
2. 🔧 Open the `vscode` folder in VSCode
3. ⚡ Press F5 to launch Extension Development Host
4. 🎨 Make improvements and submit PRs!

## 📦 File Structure

```
vscode/
├── 📄 README_FIRST.md          ← You are here!
├── 📄 INSTALL.md               ← Installation guide
├── 📄 README.md                ← Full documentation
├── 📄 QUICK_REFERENCE.md       ← Language syntax
├── 📄 EXTENSION_SUMMARY.md     ← What was created
├── 📄 CONTRIBUTING.md          ← Contribution guide
├── 📄 THEMES.md                ← Color customization
├── 📄 CHANGELOG.md             ← Version history
├── 📄 package.json             ← Extension manifest
├── 📄 language-configuration.json ← Language config
├── 📁 syntaxes/
│   └── jello.tmLanguage.json   ← Syntax grammar
├── 📁 snippets/
│   └── jello.json              ← Code snippets
├── 📁 .vscode/
│   └── launch.json             ← Debug config
└── 📄 test-syntax.jello        ← Test file
```

## 🎓 Example Code

Here's a quick taste of Jello with syntax highlighting:

```jello
// Define an actor
Counter := %{
    start: fn() {
        count := 0;
        while (true) {
            msg := Actor.receive();
            match msg {
                | (:increment) -> {
                    count = count + 1;
                    System.print(count);
                };
                | (:get, sender) -> {
                    Actor.send(sender, (:count, count));
                };
                | (:stop) -> break;
            }
        }
    }
};

// Spawn and use it
pid := Actor.spawn(Counter);
Actor.send(pid, (:increment));
Actor.send(pid, (:increment));

// Pattern matching
result := match value {
    | :Ok(x) -> x;
    | :Err(e) -> 0;
    | _ -> null;
};

System.print("PASSED");
```

## 🐛 Troubleshooting

### Extension not showing up?

- Check the folder name is exactly `jello-lang-0.1.0`
- Restart VSCode completely
- See **INSTALL.md** for detailed troubleshooting

### Syntax highlighting not working?

- Verify the file extension is `.jello`
- Check the language mode in bottom-right corner
- Try selecting "Jello" manually from the language picker

### Snippets not working?

- Make sure you're in a `.jello` file
- Type the prefix (e.g., `fn`) and press Tab
- Check that IntelliSense is enabled in settings

## 💡 Tips

1. **Use snippets** - They save tons of typing!
2. **Customize colors** - See THEMES.md for how
3. **Try the test file** - Great for learning the language
4. **Read the docs** - We wrote comprehensive guides
5. **Contribute** - Help make the extension better!

## 🌟 Features Roadmap

Future enhancements planned:

- 🔮 IntelliSense and autocomplete
- 🎯 Go to definition
- 🔍 Find all references
- 📖 Hover documentation
- 🐛 Debugger integration
- ✨ Code formatting
- 🔧 Refactoring support

See **CHANGELOG.md** for the complete roadmap.

## 🤝 Contributing

We welcome contributions! See **CONTRIBUTING.md** for:

- Development setup
- How to contribute
- Code style guidelines
- Resources and references

## 📞 Support

Need help?

- 📖 Check the documentation files
- 🐛 Open an issue on GitHub
- 💬 Join the Jello community discussions

## 📜 License

MIT License - See LICENSE file for details

## 🙏 Credits

Created for the Jello programming language based on:

- Language documentation in `../docs/`
- Test cases from `../test/`
- Language implementation in `../vm/` and `../jellocrs/`

---

## 🎯 Your Next Action

**Choose one:**

1. **Just want to use it?** → Read **QUICK_REFERENCE.md**
2. **Want detailed install?** → Read **INSTALL.md**
3. **Want to contribute?** → Read **CONTRIBUTING.md**
4. **Want to customize?** → Read **THEMES.md**
5. **Want full details?** → Read **README.md**

---

**Happy coding with Jello! 🎉**
