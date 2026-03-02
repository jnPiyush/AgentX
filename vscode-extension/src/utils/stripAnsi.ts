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
 */
export function stripAnsi(text: string): string {
 // eslint-disable-next-line no-control-regex
 return text.replace(
  /[\u001b\u009b][[()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
  ''
 );
}
