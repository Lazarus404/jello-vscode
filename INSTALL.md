# Installation Guide for Jello Extension

This guide explains how to install the Jello language extension for Visual Studio Code and Cursor.

> **Cursor Users:** Cursor uses a different extensions directory (`~/.cursor/extensions`). See [CURSOR_INSTALL.md](CURSOR_INSTALL.md) for Cursor-specific instructions, or use the `install.sh` script which auto-detects your editor.

## Method 1: Install from Source (Development)

### Prerequisites

- Visual Studio Code 1.70.0 or higher
- Node.js and npm (if you want to package the extension)

### Steps

1. **Copy the extension to your VSCode extensions folder:**

   **macOS/Linux:**

   ```bash
   cp -r vscode ~/.vscode/extensions/jello-lang-0.1.0/
   ```

   **Windows (PowerShell):**

   ```powershell
   Copy-Item -Recurse vscode $env:USERPROFILE\.vscode\extensions\jello-lang-0.1.0\
   ```

   **Windows (Command Prompt):**

   ```cmd
   xcopy /E /I vscode %USERPROFILE%\.vscode\extensions\jello-lang-0.1.0\
   ```

2. **Reload VSCode:**

   - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Reload Window" and press Enter

3. **Verify installation:**
   - Open any `.jello` file
   - Check that syntax highlighting is working
   - The language mode should show "Jello" in the bottom-right corner

## Method 2: Package and Install (Recommended)

### Prerequisites

- Node.js and npm
- `vsce` (Visual Studio Code Extension Manager)

### Steps

1. **Install vsce globally:**

   ```bash
   npm install -g @vscode/vsce
   ```

2. **Navigate to the vscode directory:**

   ```bash
   cd vscode
   ```

3. **Package the extension:**

   ```bash
   vsce package
   ```

   This creates a `.vsix` file (e.g., `jello-lang-0.1.0.vsix`)

4. **Install the extension in VSCode:**

   - Open VSCode
   - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Extensions: Install from VSIX..."
   - Select the `.vsix` file you just created

5. **Reload VSCode:**
   - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Reload Window" and press Enter

## Method 3: Development Mode

If you're working on the extension itself:

1. **Open the vscode folder in VSCode:**

   ```bash
   cd vscode
   code .
   ```

2. **Press F5 to launch Extension Development Host**

   - This opens a new VSCode window with the extension loaded
   - Any changes you make will require reloading the Extension Development Host

3. **Test with sample files:**
   - Open any `.jello` file from the `../test` directory
   - Verify syntax highlighting and language features

## Verification

After installation, test the extension with this sample code:

```jello
// Test Jello syntax highlighting
using Crypto;

// Function with pattern matching
factorial := fn(n) if n <= 1 {
    return 1;
} else {
    return n * factorial(n - 1);
};

// Match expression
result := match value {
    | :Ok(x) -> x;
    | :Err(e) -> 0;
    | _ -> null;
};

// Actor system
Counter := %{
    start: fn() {
        count := 0;
        while (true) {
            msg := Actor.receive();
            if (msg.0 == :increment) {
                count = count + 1;
                System.print(count);
            } else if (msg.0 == :stop) {
                break;
            }
        }
    }
};

pid := Actor.spawn(Counter);
Actor.send(pid, (:increment));
Actor.send(pid, (:stop));

System.print("PASSED");
```

All of the following should be highlighted correctly:

- ✅ Keywords (`fn`, `if`, `else`, `while`, `match`, `using`)
- ✅ Atoms (`:Ok`, `:Err`, `:increment`, `:stop`)
- ✅ Strings (`"PASSED"`)
- ✅ Numbers (`0`, `1`)
- ✅ Operators (`->`, `:=`, `==`)
- ✅ Built-in types (`Counter`, `Actor`, `System`)
- ✅ Comments (`//`)
- ✅ Maps (`%{...}`)
- ✅ Tuples (`(:increment)`)

## Troubleshooting

### Extension not showing up

- Make sure the folder name is `jello-lang-0.1.0`
- Check that all files are in the correct locations
- Try restarting VSCode completely

### Syntax highlighting not working

- Verify the file extension is `.jello`
- Check the language mode in the bottom-right corner
- Try manually selecting "Jello" as the language:
  - Click on the language mode selector
  - Type "Jello" and select it

### Snippets not working

- Make sure IntelliSense is enabled in VSCode settings
- Try typing a snippet prefix (e.g., `fn`) and pressing Tab
- Check that `snippets/jello.json` exists in the extension folder

## Uninstallation

To remove the extension:

1. Open VSCode
2. Go to Extensions view (`Cmd+Shift+X` or `Ctrl+Shift+X`)
3. Find "Jello Language Support"
4. Click the gear icon and select "Uninstall"

Or manually delete the extension folder:

- **macOS/Linux:** `~/.vscode/extensions/jello-lang-0.1.0/`
- **Windows:** `%USERPROFILE%\.vscode\extensions\jello-lang-0.1.0\`

## Publishing to Marketplace (Optional)

To publish the extension to the VSCode Marketplace:

1. Create a [Visual Studio Marketplace publisher account](https://marketplace.visualstudio.com/manage)
2. Get a Personal Access Token from Azure DevOps
3. Login with vsce:
   ```bash
   vsce login <publisher-name>
   ```
4. Publish:
   ```bash
   vsce publish
   ```

For more details, see the [VSCode Extension Publishing documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
