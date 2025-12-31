/* eslint-disable no-console */
// Minimal VS Code debug launcher for Jello.
//
// This extension DOES NOT implement a DAP adapter itself.
// Instead, it launches the Jello VM as the debug adapter process:
//   jello -debugger program.jlo
//
// Requirements (VM side):
// - `jello -debugger` auto-loads debug.jdll and starts the DAP server on stdio
// - stdout is reserved for DAP framing while debugging (program output goes to stderr)

const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

function isJelloSource(p) {
  return typeof p === 'string' && p.toLowerCase().endsWith('.jello');
}

function jloPathForSource(p) {
  return p.replace(/\.jello$/i, '.jlo');
}

function getSetting(name, fallback) {
  const cfg = vscode.workspace.getConfiguration('jello.debugger');
  const v = cfg.get(name);
  return (v === undefined || v === null || v === '') ? fallback : v;
}

function compileIfNeeded(programPath, jellocPath) {
  if (!isJelloSource(programPath)) return programPath;

  const jlo = jloPathForSource(programPath);
  const res = cp.spawnSync(jellocPath, [programPath], { encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || `jelloc failed with exit code ${res.status}`);
  }
  if (!fs.existsSync(jlo)) {
    throw new Error(`Expected compiler output not found: ${jlo}`);
  }
  return jlo;
}

class JelloDebugConfigurationProvider {
  resolveDebugConfiguration(folder, config) {
    if (!config) config = {};

    // Default program: active file.
    if (!config.program) {
      const active = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
      if (active) config.program = active.fileName;
    }

    if (!config.program) {
      vscode.window.showErrorMessage('Jello debug: missing "program" in launch configuration.');
      return undefined;
    }

    const workspaceFolder = folder ? folder.uri.fsPath : (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] && vscode.workspace.workspaceFolders[0].uri.fsPath);
    const cwd = config.cwd || workspaceFolder || path.dirname(config.program);

    // Resolve paths: use JELLO_PATH env var if set, otherwise fall back to settings/defaults.
    const jelloPathEnv = process.env.JELLO_PATH || '';
    const jelloPathFromEnv = jelloPathEnv ? path.join(jelloPathEnv, '..', 'bin', 'jello') : '';
    const jellocPathFromEnv = jelloPathEnv ? path.join(jelloPathEnv, '..', 'bin', 'jelloc') : '';

    const jelloPath = config.jelloPath || getSetting('jelloPath', jelloPathFromEnv || 'jello');
    const jellocPath = config.jellocPath || getSetting('jellocPath', jellocPathFromEnv || 'jelloc');
    const jelloLibPath = config.jelloLibPath || getSetting('jelloLibPath', jelloPathEnv || (workspaceFolder ? path.join(workspaceFolder, 'libs') : ''));

    // Compile .jello -> .jlo if needed.
    let programToRun = config.program;
    try {
      programToRun = compileIfNeeded(programToRun, jellocPath);
    } catch (e) {
      vscode.window.showErrorMessage(`Jello debug: compile failed: ${e && e.message ? e.message : String(e)}`);
      return undefined;
    }

    // Stash resolved values on the config so the descriptor factory can use them.
    config.__jelloResolved = {
      jelloPath,
      cwd,
      programToRun,
      jelloLibPath,
    };

    return config;
  }
}

class JelloDebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(session /* , executable */) {
    const r = session.configuration.__jelloResolved;
    if (!r) {
      throw new Error('Jello debug: missing resolved configuration (did resolveDebugConfiguration run?)');
    }

    const env = Object.assign({}, process.env);
    if (r.jelloLibPath && r.jelloLibPath.length > 0) {
      env.JELLO_PATH = r.jelloLibPath;
    }

    // Pass pause-all setting via environment variable
    const pauseAll = getSetting('pauseAllActors', true);
    env.JELLO_DAP_PAUSE_ALL = pauseAll ? '1' : '0';

    // Optional default exception breakpoint mode (VS Code can still override via setExceptionBreakpoints)
    // Values: "never" | "uncaught" | "all"
    const exMode = getSetting('exceptionBreakpoints', 'uncaught');
    env.JELLO_DAP_EXCEPTION = exMode;

    // Launch the VM as the adapter process.
    const args = ['-debugger', r.programToRun];
    const options = { cwd: r.cwd, env };
    return new vscode.DebugAdapterExecutable(r.jelloPath, args, options);
  }
}

function activate(context) {
  const provider = new JelloDebugConfigurationProvider();
  context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('jello', provider));

  const factory = new JelloDebugAdapterDescriptorFactory();
  context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('jello', factory));
}

function deactivate() {}

module.exports = { activate, deactivate };

