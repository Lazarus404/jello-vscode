// The compiler's inferred types, from a typed listing made after a clean check, for hover and
// for knowing what a receiver's methods are.

import * as vscode from "vscode";
import { parseTypedSpans, TypedSpan, typeAt } from "./core/hir";
import { run } from "./core/process";
import { ByteOffsets } from "./core/text";
import { Toolchain } from "./toolchain";
import { JelloWorkspace } from "./workspace";

interface Listing {
  version: number;
  text: string;
  spans: TypedSpan[];
  offsets: ByteOffsets;
}

export class HoverTypes {
  private readonly listings = new Map<string, Listing>();
  private readonly running = new Map<string, AbortController>();

  constructor(
    private readonly toolchain: Toolchain,
    private readonly workspace: JelloWorkspace,
  ) {}

  enabled(): boolean {
    return vscode.workspace.getConfiguration("jello").get<boolean>("hoverTypes", true);
  }

  /** Lists the saved file's types; called after a check of it finds no errors. */
  async refresh(document: vscode.TextDocument): Promise<void> {
    const tools = this.toolchain.get();
    if (!tools || !this.enabled() || document.isDirty) return;
    const path = document.uri.fsPath;
    this.running.get(path)?.abort();
    const controller = new AbortController();
    this.running.set(path, controller);
    const version = document.version;
    const text = document.getText();
    const compile = this.workspace.compile(tools, path, { listing: ["--hir", "--spans"] });
    const timeoutMs = vscode.workspace
      .getConfiguration("jello")
      .get<number>("check.timeoutMs", 10_000);
    const result = await run(tools.jelloc, compile.args, {
      cwd: compile.cwd,
      env: this.toolchain.env(),
      signal: controller.signal,
      timeoutMs,
      maxOutput: 64 * 1024 * 1024,
    });
    if (this.running.get(path) === controller) this.running.delete(path);
    if (result.code !== 0) return;
    // The listing's format is not promised; one that cannot be read gives no types at all.
    let spans: TypedSpan[] = [];
    try {
      spans = parseTypedSpans(result.stdout, compile.stub ? path : undefined);
    } catch {
      spans = [];
    }
    this.listings.set(path, { version, text, spans, offsets: new ByteOffsets(text) });
  }

  /** The compiler's type for the smallest node holding `offset`, if the text there is unchanged. */
  typeAt(document: vscode.TextDocument, offset: number): TypedSpan | undefined {
    const listing = this.listings.get(document.uri.fsPath);
    if (!listing) return undefined;
    if (listing.version !== document.version) {
      // Edits after this point leave its offsets alone.
      const upTo = Math.min(offset + 64, listing.text.length);
      if (document.getText().slice(0, upTo) !== listing.text.slice(0, upTo)) return undefined;
    }
    return typeAt(listing.spans, listing.offsets.toByte(offset));
  }

  forget(path: string): void {
    this.running.get(path)?.abort();
    this.listings.delete(path);
  }
}
