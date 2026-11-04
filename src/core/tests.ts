// The test runner's output (docs/07-tooling/04-testing.md), and the tests a file declares.

import { scan } from "./scan";

export type Outcome = "passed" | "failed" | "skipped";

export interface TestMessage {
  text: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface TestResult {
  name: string;
  outcome: Outcome;
  /** Where the test is declared; subtests have none. */
  file?: string;
  line?: number;
  messages: TestMessage[];
}

export interface RunOutput {
  results: TestResult[];
  started: string[];
  /** `ok` or `FAIL` on the last line; undefined when the run never got that far. */
  passed?: boolean;
}

const RESULT = /^--- (PASS|FAIL|SKIP): (\S+)(?: \((.+):(\d+)\))?$/;
const PLACE = /^(.+?):(\d+):(\d+): (.*)$/;
const OUTCOMES: Record<string, Outcome> = { PASS: "passed", FAIL: "failed", SKIP: "skipped" };

/** Reads what a test binary printed with `-v`. */
export function parseRun(text: string): RunOutput {
  const out: RunOutput = { results: [], started: [] };
  let current: TestResult | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("=== RUN   ")) {
      out.started.push(line.slice(10).trim());
      current = undefined;
      continue;
    }
    const result = RESULT.exec(line);
    if (result) {
      current = {
        name: result[2],
        outcome: OUTCOMES[result[1]],
        file: result[3],
        line: result[4] ? Number(result[4]) : undefined,
        messages: [],
      };
      out.results.push(current);
      continue;
    }
    if (line === "ok" || line === "FAIL") {
      out.passed = line === "ok";
      current = undefined;
      continue;
    }
    if (current && line.startsWith("    ")) {
      const text = line.slice(4);
      const place = PLACE.exec(text);
      current.messages.push(
        place
          ? { text: place[4], file: place[1], line: Number(place[2]), column: Number(place[3]) }
          : { text },
      );
    }
  }
  return out;
}

/** The `got X, want Y` of a failed assertion, for an expected/actual diff. */
export function gotWant(message: string): { got: string; want: string } | undefined {
  const m = /^got (.*), want (.*)$/s.exec(message);
  return m ? { got: m[1], want: m[2] } : undefined;
}

export interface DeclaredTest {
  name: string;
  start: number;
  end: number;
}

/** A test is a top-level `let testName = fn(t: Test)`: `test` and then an upper-case letter. */
export function declaredTests(source: string): DeclaredTest[] {
  return scan(source)
    .declarations.filter((d) => d.kind === "function" && /^test[A-Z]/.test(d.name))
    .map((d) => ({ name: d.name, start: d.nameStart, end: d.nameEnd }));
}

/** The runner's name for the tests of `relative`, a path under a test root: `app/Names`. */
export function testPrefix(relative: string): string {
  return relative.replace(/\\/g, "/").replace(/\.test\.jello$/, "");
}
