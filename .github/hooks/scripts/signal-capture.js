// ---------------------------------------------------------------------------
// Frontier Signal Capture -- Copilot Hook Handler
// ---------------------------------------------------------------------------
// Captures tool usage, session markers, and error signals to
// .frontier/signals/sessions.jsonl, where `frontier discover` reads them.
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
// Session start also emits a bounded repository-context primer. Telemetry stays
// metadata-only; context failures are reported without blocking the session.
// ---------------------------------------------------------------------------
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("node:child_process");

const SIGNALS_DIR = path.join(process.cwd(), ".frontier", "signals");
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
// Frontier config used `copilot-agent:sessionStart`. Several payloads (notably
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
  }

  if (kind === "sessionstart") entry.marker = "start";
  if (kind === "sessionend" || kind === "stop") entry.marker = "end";

  return entry;
}

function requestRepositoryContext(payload, run = spawnSync, workspaceRoot = process.cwd()) {
  // Repository context is a Frontier workspace capability: never index folders that did not opt in.
  if (!fs.statSync(path.join(workspaceRoot, ".frontier", "config.json"), { throwIfNoEntry: false })?.isFile()) {
    return null;
  }
  const assetRoot = path.resolve(__dirname, "..", "..", "..");
  const candidates = [
    path.join(assetRoot, ".frontier", "runtime", "frontier-cli.ps1"),
    path.join(assetRoot, ".github", "frontier", ".frontier", "runtime", "frontier-cli.ps1"),
    path.join(workspaceRoot, ".frontier", "runtime", "frontier.ps1"),
  ];
  const cli = candidates.find(candidate => fs.statSync(candidate, { throwIfNoEntry: false })?.isFile());
  if (!cli) throw new Error("Frontier runtime not found; initialize or update Frontier");
  const result = run("pwsh", ["-NoProfile", "-NonInteractive", "-File", cli, "context", "--hook"], {
    cwd: workspaceRoot,
    env: { ...process.env, FRONTIER_WORKSPACE_ROOT: workspaceRoot },
    input: JSON.stringify(payload),
    encoding: "utf8",
    windowsHide: true,
    timeout: 8000,
    maxBuffer: 65536,
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.code || `context command exited ${result.status}`);
  }
  const output = JSON.parse(result.stdout);
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("context command returned an invalid hook response");
  }
  return output;
}

module.exports = { buildEntry, normalizeEventName, parsePayload, requestRepositoryContext };

async function main() {
  const payload = parsePayload(await readStdin());
  const entry = buildEntry(payload);
  try {
    appendSignal(entry);
  } catch (_) {
    // Signal capture must never block the session
  }
  if (entry.event.toLowerCase() === "sessionstart") {
    try {
      const response = requestRepositoryContext(payload);
      if (response) process.stdout.write(JSON.stringify(response) + "\n");
    } catch (error) {
      process.stderr.write(`[frontier-context] Repository context unavailable (${error.message}); run frontier context to diagnose.\n`);
    }
  }
  process.exit(0);
}

if (require.main === module) {
  void main();
}
