// Runs a tool with a time limit, a cap on what it may print, and a way to call it off.

import { spawn } from "node:child_process";

export interface RunOptions {
  cwd?: string;
  timeoutMs?: number;
  /** Characters kept of each stream; a listing of a big program can be large. */
  maxOutput?: number;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  input?: string;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  /** Set when the program could not be started at all. */
  error?: string;
}

export function run(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  const max = options.maxOutput ?? 8 * 1024 * 1024;
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let cancelled = false;
    let settled = false;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    const finish = (result: Partial<RunResult>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      resolve({ code: null, stdout, stderr, timedOut, cancelled, ...result });
    };
    const abort = () => {
      cancelled = true;
      child.kill();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs ?? 10_000);
    options.signal?.addEventListener("abort", abort);
    if (options.signal?.aborted) abort();

    child.stdout?.setEncoding("utf8").on("data", (d: string) => {
      if (stdout.length < max) stdout += d.slice(0, max - stdout.length);
    });
    child.stderr?.setEncoding("utf8").on("data", (d: string) => {
      if (stderr.length < max) stderr += d.slice(0, max - stderr.length);
    });
    if (options.input !== undefined) child.stdin?.end(options.input);
    child.on("error", (e) => finish({ error: e.message }));
    child.on("close", (code) => finish({ code }));
  });
}
