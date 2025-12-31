# Jello Debugger Guide for VS Code

This guide explains how to use the Jello debugger in Visual Studio Code with the Debug Adapter Protocol (DAP).

## Overview

The Jello debugger uses the VM itself as a DAP adapter: when you run `jello -debugger program.jlo`, the VM:
1. Automatically loads `debug.jdll` and starts a DAP server on stdio
2. Pauses at entry (stop-on-entry)
3. Waits for VS Code to send breakpoints via the DAP protocol
4. Resumes on `configurationDone` and runs until breakpoints or completion

**Zero-overhead when not debugging**: The `-debugger` flag is the *only* trigger. Without it, your program runs at full speed with no instrumentation.

## Requirements

- **Jello VM**: Check that `jello -debugger` does not error
- **VS Code**: 1.70.0 or later
- **Extension**: `jello-lang` v0.2.0+ (includes debugger integration)

## Quick Start

### 1. Install the Extension

Follow [INSTALL.md](./INSTALL.md) to install the Jello extension.

### 2. Configure VS Code Settings (Optional)

The extension uses the `JELLO_PATH` environment variable to locate `jello`, `jelloc`, and libraries:
- If `JELLO_PATH` is set (e.g., `/path/to/jello-lang/libs`), the extension will use:
  - `jelloPath`: `$JELLO_PATH/../bin/jello`
  - `jellocPath`: `$JELLO_PATH/../bin/jelloc`
  - `jelloLibPath`: `$JELLO_PATH`

You can override these in VS Code settings (`.vscode/settings.json` or User Settings):

```json
{
  "jello.debugger.jelloPath": "/custom/path/to/jello",
  "jello.debugger.jellocPath": "/custom/path/to/jelloc",
  "jello.debugger.jelloLibPath": "/custom/path/to/libs"
}
```

**Defaults** (if `JELLO_PATH` is not set and settings are empty):
- `jelloPath`: `jello` (assumes it's in `$PATH`)
- `jellocPath`: `jelloc` (assumes it's in `$PATH`)
- `jelloLibPath`: `${workspaceFolder}/libs` (relative to your project)

### 3. Create a Launch Configuration

Add a `.vscode/launch.json` file to your project:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "jello",
      "request": "launch",
      "name": "Debug Jello Program",
      "program": "${file}",
      "cwd": "${workspaceFolder}",
      "stopOnEntry": true
    }
  ]
}
```

### 4. Start Debugging

1. Open a `.jello` or `.jlo` file
2. Set breakpoints by clicking in the gutter (left of line numbers)
3. Press `F5` or click **Run > Start Debugging**
4. The debugger will:
   - Compile `.jello` → `.jlo` if needed (via `jelloc`)
   - Launch `jello -debugger program.jlo`
   - Pause at entry
   - Stop at your breakpoints

## Launch Configuration Options

### `program` (required)

Path to the program to debug. Can be:
- `.jello` source file (will be compiled to `.jlo` automatically)
- `.jlo` bytecode file (runs directly)

**Variables**:
- `${file}`: Currently open file
- `${workspaceFolder}`: Workspace root
- `${relativeFile}`: Relative path from workspace root

**Examples**:
```json
"program": "${file}"                          // Current file
"program": "${workspaceFolder}/main.jello"    // Specific file
"program": "${workspaceFolder}/build/app.jlo" // Precompiled bytecode
```

### `cwd` (optional)

Working directory for the program. Defaults to `${workspaceFolder}`.

```json
"cwd": "${workspaceFolder}/examples"
```

### `stopOnEntry` (optional)

Pause at the first instruction. Defaults to `true`.

```json
"stopOnEntry": false  // Run immediately until first breakpoint
```

### `args` (optional)

Command-line arguments passed to the program.

```json
"args": ["arg1", "arg2"]
```

### `env` (optional)

Environment variables for the program.

```json
"env": {
  "JELLO_PATH": "/custom/libs",
  "DEBUG": "1",
  "JELLO_DAP_PAUSE_ALL": "1"
}
```

**Special environment variables:**
- `JELLO_DAP_PAUSE_ALL`: When set to `1`, pausing or stepping in one actor will pause all other actors. Useful for deterministic multi-actor debugging.
- `JELLO_DAP_TRACE`: When set to `1`, enables detailed debug adapter logging to stderr.

### `preLaunchTask` (optional)

Task to run before debugging (e.g., rebuild, clean).

```json
"preLaunchTask": "build-jello"
```

## Example Configurations

### Debug Current File

```json
{
  "type": "jello",
  "request": "launch",
  "name": "Debug Current File",
  "program": "${file}",
  "stopOnEntry": true
}
```

### Debug Specific Program

```json
{
  "type": "jello",
  "request": "launch",
  "name": "Debug Main",
  "program": "${workspaceFolder}/src/main.jello",
  "cwd": "${workspaceFolder}",
  "stopOnEntry": false
}
```

### Debug Precompiled Bytecode

```json
{
  "type": "jello",
  "request": "launch",
  "name": "Debug Release Build",
  "program": "${workspaceFolder}/build/app.jlo",
  "stopOnEntry": false
}
```

### Debug with Coordinated Actor Pausing

```json
{
  "type": "jello",
  "request": "launch",
  "name": "Debug Multi-Actor (Pause All)",
  "program": "${file}",
  "env": {
    "JELLO_DAP_PAUSE_ALL": "1"
  }
}
```

## Debugging Features

### ✅ Breakpoints

#### Basic Breakpoints
- Click in the gutter (left margin) to set/clear breakpoints
- Breakpoints are resolved to bytecode PC using debug info
- Verified breakpoints show as solid red circles
- Unverified breakpoints show as gray circles (no executable code at that line)

#### Conditional Breakpoints
Right-click on a breakpoint → **Edit Breakpoint** → **Expression**

Set a condition that must be true for the breakpoint to stop:

```javascript
// Examples:
pc == 100              // Stop only when program counter is 100
threadId == 2          // Stop only in actor 2
hitCount == 5          // Stop on the 5th hit
opcode == 42           // Stop when executing specific opcode
```

**Supported variables:**
- `pc`: Program counter (bytecode offset)
- `opcode`: Current opcode being executed
- `param`: Current opcode parameter
- `threadId`: Actor/thread ID
- `hitCount`: Number of times this breakpoint has been hit

**Supported operators:**
- `==`, `!=`, `<`, `>`, `<=`, `>=`

#### Hit Count Breakpoints
Right-click on a breakpoint → **Edit Breakpoint** → **Hit Count**

Stop only after the breakpoint has been hit N times:
```
5        // Stop on 5th hit
10       // Stop on 10th hit
```

#### Logpoints
Right-click on a breakpoint → **Edit Breakpoint** → **Log Message**

Print a message to stderr instead of stopping:
```
Hit counter at line 42
Actor {threadId} reached checkpoint
```

Logpoints don't pause execution—they just print and continue.

### ✅ Stepping

- **Continue (F5)**: Resume execution until next breakpoint
- **Step Over (F10)**: Execute current line, step to next line (same depth)
- **Step Into (F11)**: Step into function calls
- **Step Out (Shift+F11)**: Continue until current function returns

Stepping uses temporary breakpoints at the next different source line and filters intermediate stops for accurate line-level behavior.

### ✅ Stack Traces

When paused, the **Call Stack** pane shows:
- Current frame (where execution stopped)
- All parent frames from the call stack
- Function names (if available in debug info)
- Source file and line number for each frame
- Program counter (PC) for each frame

Click on any frame to view its variables.

### ✅ Variables

The **Variables** pane shows three scopes:

#### Locals
Shows local variables in the current stack frame:
- Named locals (e.g., `x`, `y`, `count`) with PC-based lifetimes
- Function parameters (if emitted by compiler)
- Fallback: `argc`, `arg0`, `arg1`, ..., `r0`, `r1`, ... (when no debug metadata)

**Note**: Variables are only visible when the PC is within their lifetime range (tracked by compiler debug info).

#### Globals
Shows module-level globals:
- `g[0]`, `g[1]`, ... (global slot indexes)
- `self` (current actor's self value)

#### Internals
Shows VM internals for debugging:
- `pc`: Program counter
- `opcode`: Last executed opcode
- `param`: Last opcode parameter
- `paused`: Whether VM is paused
- `self`: Actor self value (expandable)

### ✅ Expandable Values

Complex values show a `>` icon and can be expanded:

#### Arrays
- `length`: Array length
- `[0]`, `[1]`, ... : Array elements (bounded to 128 for performance)

#### Tuples
- `length`: Tuple length
- `[0]`, `[1]`, ... : Tuple elements (bounded to 128)

#### Objects
- `__proto__`: Prototype chain (if present)
- Field names (reverse-resolved from module field table)
- `field#N`: Fallback when field name can't be resolved

### ✅ Watch Expressions

Add expressions to the **Watch** pane to evaluate them while paused.

**Supported expression syntax** (read-only, safe subset):

#### Root identifiers:
```javascript
self         // Current actor's self value
pc           // Program counter
opcode       // Last executed opcode
param        // Last opcode parameter
argc         // Number of arguments in current frame
arg0         // First argument (arg0, arg1, arg2, ...)
r0           // Register 0 (r0, r1, r2, ...)
g[42]        // Global slot 42
```

#### Chaining:
```javascript
self.field         // Object field access
self.items[0]      // Array/tuple indexing
r0.nested.deep     // Multiple levels
g[5].data[1].x     // Complex paths
```

**Examples:**
```javascript
self.count
self.items[0].name
r0.status
g[0].config.debug
```

**Limitations:**
- Read-only (no assignments or function calls)
- No arithmetic or comparisons in watch expressions
- Object field access requires the field name to be in the module's field table

### ✅ Hover Evaluation

Hover over variables in your source code while debugging to see their values. Uses the same expression evaluator as watch expressions.

### ✅ Multi-Actor/Thread Debugging

Jello's actor system means multiple actors (VMs) can run concurrently. The debugger is actor-aware:

#### Threads Pane
Shows all active actors as separate threads:
- `actor-1`: Main actor
- `actor-2`, `actor-3`, ...: Spawned actors
- Each actor has a stable thread ID

#### Pause Behavior

**Default** (per-actor pausing):
- When one actor stops at a breakpoint, others continue running
- Useful for debugging specific actors without freezing the whole system

**Coordinated** (pause-all mode):
- Set `JELLO_DAP_PAUSE_ALL=1` environment variable
- When any actor stops, all actors pause
- Useful for deterministic debugging of actor interactions

**Explicit pause:**
- Click **Pause** button or press `F6` to pause a specific actor
- In pause-all mode, this pauses all actors

#### Switching Between Actors

When multiple actors are paused:
1. Click on an actor in the **Call Stack** pane
2. The editor, variables, and watches update to show that actor's state
3. Step/continue commands apply to the selected actor

### ✅ Source Mapping

The debugger maps bytecode PCs back to source locations using `JDBG` debug info:
- Accurate file:line:column mapping
- Works with optimizations (as long as debug info is emitted)
- Fallback to basename matching when full paths don't match

Debug info is embedded by `jelloc` by default. To compile without debug info:
```bash
jelloc --no-debug program.jello  # (if flag exists; check jelloc --help)
```

### ✅ Pause on Demand

Click the **Pause** button in VS Code's debug toolbar (or press `F6`) to pause execution at any time. The VM will pause at the next safe point (between instructions).

### ✅ Hot Code Inspection

While paused, you can:
- Modify source files (changes won't take effect until restart)
- Add/remove breakpoints (take effect immediately)
- Evaluate watch expressions to inspect state

## Troubleshooting

### Breakpoints Not Stopping

**Symptoms**: Debugger runs to completion without stopping at breakpoints.

**Causes**:
1. **No debug info**: `.jlo` file compiled without debug info
   - Solution: Recompile with `jelloc program.jello` (debug info is on by default)
   - Check: `xxd program.jlo | grep JDBG` should show the debug section

2. **Wrong line number**: Breakpoint set on a comment or blank line
   - Solution: Move breakpoint to an executable line (e.g., `x := 1`)

3. **Optimized away**: Dead code eliminated by compiler
   - Solution: Ensure the code is actually reachable

4. **Incorrect path matching**: Source file path doesn't match debug info
   - Check: Ensure source files haven't moved since compilation

### "Library not found: 'debug'"

**Symptoms**: Error when starting debugger: `jdll failure: Library not found: 'debug'`

**Cause**: `debug.jdll` is not in `JELLO_PATH`.

**Solution**:
1. Check your `jello.debugger.jelloLibPath` setting
2. Ensure `debug.jdll` exists at `${jelloLibPath}/debug.jdll`
3. Default location: `${workspaceFolder}/libs/debug.jdll`
4. If using a custom build location, update the setting or set `JELLO_PATH` environment variable

### Program Output Missing

**Symptoms**: `System.print` output doesn't appear in Debug Console.

**Cause**: While debugging, stdout is reserved for DAP protocol. User output goes to **stderr**.

**Solution**: 
- Check the **Terminal** pane for stderr output
- Use `System.eprintln` for debug logging (writes to stderr)

**Workaround**: Run without `-debugger` to see normal stdout behavior.

### Debugger Hangs on "Configuring..."

**Symptoms**: VS Code shows "Configuring..." forever.

**Causes**:
1. **VM version mismatch**: Old VM doesn't support `-debugger`
   - Solution: Rebuild VM from latest source
   
2. **Stdio corruption**: Something wrote to stdout before DAP started
   - Solution: Check for rogue `printf` in VM startup code
   - Check: Run `jello -debugger program.jlo` manually to see output

3. **Deadlock**: Internal bug in pause/resume logic
   - Solution: Check for `JELLO_DAP_TRACE=1` output in stderr
   - Report: File a bug with reproducible `.jello` file

### Variables Show `<no vm>` or Are Missing

**Symptoms**: Variables pane shows placeholder text or empty scopes.

**Causes**:
1. **Not paused**: Variables only update when execution is paused
   - Solution: Set a breakpoint or click Pause

2. **Frame not selected**: Wrong stack frame is selected
   - Solution: Click on the correct frame in Call Stack pane

3. **Locals out of scope**: Variable lifetime doesn't include current PC
   - Solution: This is correct behavior; the variable doesn't exist at this PC

4. **No locals metadata**: Compiler didn't emit locals debug info
   - Fallback: Use the Internals scope or evaluate `r0`, `arg0`, etc.

### Conditional Breakpoint Not Working

**Symptoms**: Breakpoint with condition stops every time (or never).

**Causes**:
1. **Syntax error**: Condition expression is invalid
   - Check: Use simple expressions like `pc == 100` or `hitCount == 5`
   - Avoid: Complex expressions or Jello syntax not supported

2. **Variable not available**: Used unsupported variable name
   - Supported: `pc`, `opcode`, `param`, `threadId`, `hitCount`
   - Not supported: Local variable names in conditions

3. **Wrong operator**: Typo in operator
   - Use: `==`, `!=`, `<`, `>`, `<=`, `>=`
   - Not: `=`, `===`, `and`, `or`

### Stepping Skips Lines or Goes to Wrong Place

**Symptoms**: Step Over/Into goes to unexpected location.

**Causes**:
1. **Multiple statements per line**: Compiler inlined multiple operations
   - Expected: May stop multiple times on same source line

2. **Optimized code**: Compiler reordered or eliminated operations
   - Expected: Some steps may appear non-sequential

3. **Macro expansion**: Step into a macro shows expanded code location
   - Expected: May jump to macro definition site

4. **No debug info for line**: Gap in debug info mapping
   - Expected: Step may jump to next available line with debug info

### Logpoint Output Not Appearing

**Symptoms**: Logpoint doesn't print to console.

**Cause**: Logpoint output goes to **stderr**, not VS Code Debug Console.

**Solution**: Check the **Terminal** pane or run with `JELLO_DAP_TRACE=1` to see adapter diagnostics.

### JDLL Search Path (`JELLO_PATH`)

**Symptoms**: Errors like `jdll failure: Library not found: 'debug'` or `Cannot load JDLL 'std'`.

**Cause**: Jello searches for `.jdll` files (including `debug.jdll`) using the `JELLO_PATH` environment variable.

**How JELLO_PATH Works**:
1. The extension automatically sets `JELLO_PATH` to `${workspaceFolder}/libs` by default
2. You can override this in VS Code settings: `jello.debugger.jelloLibPath`
3. The debugger requires `debug.jdll` to be in `JELLO_PATH`

**Solutions**:

1. **Default setup** (recommended):
   - Keep `debug.jdll`, `std.jdll`, etc. in `${workspaceFolder}/libs/`
   - Example structure:
     ```
     my-project/
       libs/
         debug.jdll
         std.jdll
         hello.jdll
       src/
         main.jello
     ```

2. **Custom build location**:
   - In VS Code settings, set `jello.debugger.jelloLibPath` to your build output
   - Example: `/Users/me/jello-lang/build/libs`

3. **System-wide installation**:
   - Set `JELLO_PATH` environment variable globally
   - Example (macOS/Linux): `export JELLO_PATH=/usr/local/lib/jello`
   - Extension will use this if `jelloLibPath` setting is not specified

**Debugging JELLO_PATH issues**:
```bash
# Check where jello looks for JDLLs
echo $JELLO_PATH

# Verify debug.jdll exists
ls -l $JELLO_PATH/debug.jdll

# Test manually
JELLO_PATH=./libs jello -debugger program.jlo
```

### macOS: Quarantine / Code Signing

**Symptoms** (macOS only):
- `"jello" cannot be opened because the developer cannot be verified`
- Debugger fails to start with gatekeeper error

**Cause**: macOS Gatekeeper quarantines unsigned binaries downloaded from the internet or built locally.

**Solutions**:

1. **Remove quarantine attribute** (quick fix for local builds):
   ```bash
   # Remove quarantine from jello binary
   xattr -d com.apple.quarantine /path/to/jello
   
   # Remove quarantine from all .jdll files
   xattr -d com.apple.quarantine /path/to/libs/*.jdll
   ```

2. **Allow in System Settings** (for downloaded binaries):
   - System Settings → Privacy & Security
   - Scroll to "Security" section
   - Click "Open Anyway" next to the blocked app
   - Try launching again

3. **Build from source** (best for development):
   ```bash
   # Clone and build locally
   git clone https://github.com/lazarus404/jello-lang
   cd jello-lang
   bash build.sh
   
   # Binaries in build/bin/ won't be quarantined
   ```

4. **Code sign** (for distribution):
   ```bash
   # Sign with your developer certificate (if you have one)
   codesign -s "Developer ID Application: Your Name" build/bin/jello
   codesign -s "Developer ID Application: Your Name" libs/*.jdll
   ```

**Note**: If you see `"killed: 9"` errors on macOS, this is likely Gatekeeper. Use `xattr -d` to fix.

### Pause-All vs Per-Actor Debugging

The debugger supports two pause policies for multi-actor programs:

**Per-Actor (default)**:
- When one actor hits a breakpoint, only that actor pauses
- Other actors continue running
- Best for: Debugging specific actors without freezing the whole system

**Pause-All**:
- When any actor hits a breakpoint, **all actors** pause
- Best for: Deterministic debugging of actor interactions

**How to enable Pause-All**:
1. Open VS Code settings (⌘+,)
2. Search for "Jello"
3. Enable: `Jello: Debugger > Pause All Actors`

Or manually in `settings.json`:
```json
{
  "jello.debugger.pauseAllActors": true
}
```

**Behind the scenes**: This sets the `JELLO_DAP_PAUSE_ALL` environment variable for the debug session.

### Exception Breakpoints

**What are exception breakpoints?**

Exception breakpoints let you automatically pause when exceptions are thrown, even if they're caught by try/catch blocks.

**How to enable**:

1. **In VS Code**:
   - Open Debug sidebar
   - Expand "BREAKPOINTS" section
   - Enable "Uncaught Exceptions" or "All Exceptions"

2. **Via Settings**:
   ```json
   {
     "jello.debugger.exceptionBreakpoints": "uncaught"  // or "all" or "never"
   }
   ```

**Modes**:
- **never** (off): Don't pause on exceptions
- **uncaught** (default): Pause only when exception reaches top-level (no catch block)
- **all**: Pause on every `throw`, even if caught

**Example**:
```jello
fn main() {
  try {
    throw (:Error, "Something went wrong");  // Pause here if mode="all"
  } catch e {
    System.println("Caught: " + e);
  }
}
```

With `exceptionBreakpoints: "all"`, the debugger will pause at the `throw` line **before** the catch block runs, letting you inspect the exception and stack trace.

**When paused on exception**:
- **Variables pane**: Shows exception value in `vm.exception`
- **Call Stack**: Shows where the exception was thrown
- **Debug Console**: Shows exception message in stopped event

## Advanced: Manual DAP Testing

You can test the DAP adapter directly without VS Code:

```bash
# Compile your program
jelloc program.jello

# Start DAP adapter (stdio mode)
jello -debugger program.jlo
```

The VM will wait for DAP protocol messages on stdin. Example DAP request:

```
Content-Length: 123

{"seq":1,"type":"request","command":"initialize","arguments":{"adapterID":"jello"}}
```

**Not recommended** for normal use—this is for VM/adapter developers debugging the protocol implementation.

## Architecture (For VM Developers)

The Jello debugger uses **opcode patching** for breakpoints:

1. When you set a breakpoint at `file.jello:7`, the DAP adapter:
   - Resolves `(file, line)` → `pc` (byte offset) using `JDBG` entries
   - Calls `jello_debug_set_breakpoint_pc(vm, pc)`
   
2. `jello_debug_set_breakpoint_pc`:
   - Patches the bytecode at `pc` by replacing the original opcode with `OP_Breakpoint`
   - Stores the original opcode in a patch table
   
3. When the interpreter hits `OP_Breakpoint`:
   - Looks up the original opcode from the patch table
   - Calls `jello_debug_pause_here(vm)` (blocks on a semaphore)
   - DAP watch thread detects the pause and sends a `stopped` event
   - When VS Code sends `continue`, the semaphore is released
   - The interpreter tail-dispatches to the original opcode
   
This achieves **zero overhead when not debugging**: without `-debugger`, the bytecode is never patched, and the interpreter never checks for breakpoints.

### Threading Model

The debugger uses a **three-thread architecture**:

1. **VM thread**: Runs user code, pauses at breakpoints
2. **DAP reader thread**: Reads JSON-RPC messages from stdin, dispatches commands
3. **Watch thread**: Polls VM pause state, emits DAP `stopped` events

This design allows:
- Non-blocking DAP I/O (stdin reading doesn't block VM)
- Async pause detection (watch thread polls, VM thread just sets flag)
- Clean shutdown (threads can be joined independently)

### Breakpoint Features Implementation

- **Conditions**: Evaluated at stop time by adapter (not VM)
- **Hit counts**: Tracked by adapter, incremented on each hit
- **Logpoints**: Print to stderr instead of emitting `stopped` event
- **Temporary breakpoints** (for stepping): Set/cleared automatically by adapter

All these features have **zero hot-path cost** when breakpoint isn't hit.

## Performance Considerations

| Scenario | Overhead | Notes |
|----------|----------|-------|
| No `-debugger` flag | **0%** | Debug code not loaded |
| Debugger attached, no breakpoints | **~0%** | One cold branch per opcode patch site |
| Breakpoint hit | **~10µs** | Pause coordination + event emission |
| Single-step | **~10µs/step** | Temp breakpoint + stop filtering |
| Other actors (not debugging) | **0%** | No shared state |

## Contributing

Found a bug? Have a feature request?

- **VM/Debugger bugs**: Report in the main [jello-lang](https://github.com/lazarus404/jello-lang) repo
- **VS Code integration bugs**: Report in the [jello-vscode](https://github.com/lazarus404/jello-vscode) repo

## See Also

- [DEBUGGER.md](https://github.com/Lazarus404/jello-lang/tree/main/DEBUGGER.md) - Overall debugger architecture and design decisions
- [extension.js](./extension.js) - VS Code extension implementation
- [package.json](./package.json) - Extension manifest and DAP configuration
