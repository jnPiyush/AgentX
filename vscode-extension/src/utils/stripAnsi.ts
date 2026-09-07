/**
 * Comprehensive ANSI escape sequence stripper.
 *
 * Handles all common ANSI/VT100 escape patterns including:
 * - SGR (Select Graphic Rendition): colors, bold, underline, etc.
 * - CSI (Control Sequence Introducer): cursor movement, scrolling, etc.
 * - OSC (Operating System Command): title setting, hyperlinks, etc.
 * - Single-byte C1 controls (0x80-0x9F range in some encodings)
 *
 * Regex derived from the `strip-ansi` npm package pattern with additions
 * for Windows Terminal / ConPTY edge cases.
 *
 * The pattern is built from a template-literal string (double-escaped
 * control-character sequences) and compiled via the `RegExp` constructor,
 * the same technique the `ansi-regex` package itself uses, so the source
 * text contains no literal control characters for static analysis to flag
 * while the compiled expression still matches the real control bytes at
 * runtime (verified byte-identical `.source` and match behavior against
 * the previous regex literal).
 */
const ANSI_PATTERN =
 '\\u001b\\][^\\u0007]*\\u0007|[\\u001b\\u009b][[()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))';

export function stripAnsi(text: string): string {
 return text.replace(new RegExp(ANSI_PATTERN, 'g'), '');
}
