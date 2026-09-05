// ---------------------------------------------------------------------------
// AgentX Signal Capture -- Copilot Hook Handler
// ---------------------------------------------------------------------------
// Captures tool usage, session markers, and error signals to
// .agentx/signals/sessions.jsonl for downstream pattern discovery.
//
// Invoked by the lifecycle hooks declared in copilot-hooks.json.
//
// Hosts deliver the hook payload as a single JSON document on stdin. GitHub
// Copilot CLI uses camelCase event names (sessionStart, preToolUse) while
// VS Code uses PascalCase (SessionStart, PreToolUse), and both snake_case and
// camelCase payload keys appear across host versions. This handler accepts all
// of those shapes and falls back to the legacy COPILOT_HOOK_* environment
// variables so older hosts keep working.
//
// Runs silently -- failures never block the session.
// ---------------------------------------------------------------------------
"use strict";

const fs = require("fs");
const path = require("path");

const SIGNALS_DIR = path.join(process.cwd(), ".agentx", "signals");
const SIGNALS_FILE = path.join(SIGNALS_DIR, "sessions.jsonl");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB rotation threshold
const MAX_STDIN_BYTES = 1024 * 1024; // Stop reading pathological payloads
const STDIN_TIMEOUT_MS = 2000; // Never hold the session open

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
  fs.appendFileSync(SIGNALS_FILE, JSON.stringify(entry) + "\n", "utf8");
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }

    let data = "";
    let settled = false;
    let timer;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(data);
    };

    timer = setTimeout(finish, STDIN_TIMEOUT_MS);
    if (typeof timer.unref === "function") timer.unref();

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
      if (data.length >= MAX_STDIN_BYTES) finish();
    });
    process.stdin.on("end", finish);
    process.stdin.on("error", finish);
  });
}

function parsePayload(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function pick(payload, keys, envValue) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null) return value;
  }
  return envValue === undefined ? null : envValue;
}

// Copilot CLI emits `sessionStart`; VS Code emits `SessionStart`; the retired
// AgentX config used `copilot-agent:sessionStart`. Several payloads (notably
// postToolUse) carry no event field at all, so the hook configuration passes the
// event name as the first argument. Precedence: argument, payload, environment.
function normalizeEventName(payload) {
  const fromArgs = process.argv[2];
  const raw = (typeof fromArgs === "string" && fromArgs.trim())
    ? fromArgs
    : pick(
      payload,
      ["hookEventName", "hook_event_name", "eventName", "event_name", "event"],
      process.env.COPILOT_HOOK_EVENT,
    );
  const name = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
  return name.replace(/^copilot-agent:/, "");
}

function stringify(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function coerceObject(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_) {
      return value;
    }
  }
  return value;
}

function truncate(str, max) {
  if (!str) return null;
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function buildEntry(payload) {
  const event = normalizeEventName(payload);
  const kind = event.toLowerCase();

  const entry = {
    timestamp: new Date().toISOString(),
    event,
    sessionId: pick(payload, ["sessionId", "session_id"], process.env.COPILOT_HOOK_SESSION_ID),
  };

  if (kind === "pretooluse" || kind === "posttooluse") {
    entry.tool = pick(payload, ["toolName", "tool_name"], process.env.COPILOT_HOOK_TOOL_NAME);
    entry.toolArgs = coerceObject(
      pick(
        payload,
        ["toolInput", "tool_input", "toolArgs", "tool_args"],
        process.env.COPILOT_HOOK_TOOL_ARGS,
      ),
    );
    entry.toolResult = truncate(
      stringify(
        pick(
          payload,
          ["toolResponse", "tool_response", "toolResult", "tool_result"],
          process.env.COPILOT_HOOK_TOOL_RESULT,
        ),
      ),
      500,
    );
  }

  if (kind === "userpromptsubmitted" || kind === "userpromptsubmit") {
    entry.prompt = truncate(
      stringify(pick(payload, ["prompt", "userPrompt", "user_prompt"], process.env.COPILOT_HOOK_PROMPT)),
      500,
    );
  }

  if (kind === "erroroccurred") {
    entry.error = truncate(
      stringify(
        pick(
          payload,
          ["message", "error", "errorMessage", "error_message"],
          process.env.COPILOT_HOOK_ERROR_MESSAGE,
        ),
      ),
      500,
    );
  }

  if (kind === "sessionstart") entry.marker = "start";
  if (kind === "sessionend" || kind === "stop") entry.marker = "end";

  return entry;
}

module.exports = { buildEntry, normalizeEventName, parsePayload };

async function main() {
  try {
    appendSignal(buildEntry(parsePayload(await readStdin())));
  } catch (_) {
    // Signal capture must never block the session
  }
  process.exit(0);
}

if (require.main === module) {
  void main();
}
