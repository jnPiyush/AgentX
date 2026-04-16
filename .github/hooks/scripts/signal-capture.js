// ---------------------------------------------------------------------------
// AgentX Signal Capture -- Copilot Hook Handler
// ---------------------------------------------------------------------------
// Captures tool usage, session markers, and error signals to
// .agentx/signals/sessions.jsonl for downstream pattern discovery.
//
// Invoked by Copilot lifecycle hooks defined in copilot-hooks.json.
// Runs silently -- failures never block the Copilot session.
// ---------------------------------------------------------------------------
"use strict";

const fs = require("fs");
const path = require("path");

const SIGNALS_DIR = path.join(process.cwd(), ".agentx", "signals");
const SIGNALS_FILE = path.join(SIGNALS_DIR, "sessions.jsonl");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB rotation threshold

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function rotateIfNeeded() {
  try {
    if (!fs.existsSync(SIGNALS_FILE)) return;
    const stats = fs.statSync(SIGNALS_FILE);
    if (stats.size > MAX_FILE_SIZE) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const archive = path.join(SIGNALS_DIR, `sessions-${ts}.jsonl`);
      fs.renameSync(SIGNALS_FILE, archive);
    }
  } catch (_) {
    // Rotation failure is non-fatal
  }
}

function appendSignal(entry) {
  ensureDir(SIGNALS_DIR);
  rotateIfNeeded();
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(SIGNALS_FILE, line, "utf8");
}

function captureFromEnv() {
  // Copilot passes hook context via COPILOT_HOOK_* env vars
  const hookEvent = process.env.COPILOT_HOOK_EVENT || "unknown";
  const entry = {
    timestamp: new Date().toISOString(),
    event: hookEvent,
    sessionId: process.env.COPILOT_HOOK_SESSION_ID || null,
  };

  // Tool use events carry tool name and arguments
  if (hookEvent === "copilot-agent:postToolUse") {
    entry.tool = process.env.COPILOT_HOOK_TOOL_NAME || null;
    entry.toolArgs = safeParse(process.env.COPILOT_HOOK_TOOL_ARGS);
    entry.toolResult = truncate(process.env.COPILOT_HOOK_TOOL_RESULT, 500);
  }

  // User prompts carry the request text
  if (hookEvent === "copilot-agent:userPromptSubmitted") {
    entry.prompt = truncate(process.env.COPILOT_HOOK_PROMPT, 500);
  }

  // Errors carry the message
  if (hookEvent === "copilot-agent:errorOccurred") {
    entry.error = truncate(process.env.COPILOT_HOOK_ERROR_MESSAGE, 500);
  }

  // Session markers
  if (hookEvent === "copilot-agent:sessionStart") {
    entry.marker = "start";
  }
  if (hookEvent === "copilot-agent:sessionEnd") {
    entry.marker = "end";
  }

  return entry;
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return raw;
  }
}

function truncate(str, max) {
  if (!str) return null;
  return str.length > max ? str.slice(0, max) + "..." : str;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
try {
  const entry = captureFromEnv();
  if (entry) {
    appendSignal(entry);
  }
} catch (_) {
  // Signal capture must never block the Copilot session
}

process.exit(0);