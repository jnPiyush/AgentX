// ---------------------------------------------------------------------------
// AgentX -- Session State Manager
// ---------------------------------------------------------------------------
//
// Persists conversation history, tool-call records, and metadata across turns
// so the agentic loop can resume, compact, or replay prior context.
//
// Storage backends:
//   - VS Code workspaceState (default, fast, ephemeral per workspace)
//   - File-based (.agentx/sessions/) for durable persistence
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

const CHARS_PER_TOKEN = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single message in the conversation. */
export interface SessionMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  /** Present when role === 'assistant' and LLM requested tool calls. */
  readonly toolCalls?: readonly SessionToolCall[];
  /** Present when role === 'tool' to correlate with the request. */
  readonly toolCallId?: string;
  /** ISO-8601 timestamp. */
  readonly timestamp: string;
}

/** A tool call as recorded in the session. */
export interface SessionToolCall {
  readonly id: string;
  readonly name: string;
  readonly params: Record<string, unknown>;
}

/** Metadata about the session. */
export interface SessionMeta {
  readonly sessionId: string;
  readonly agentName: string;
  readonly issueNumber?: number;
  readonly createdAt: string;
  updatedAt: string;
  turnCount: number;
  toolCallCount: number;
  totalTokensEstimate: number;
  /** If true, the session has been compacted at least once. */
  compacted: boolean;
}

/** Full session state (serializable). */
export interface SessionState {
  readonly meta: SessionMeta;
  messages: SessionMessage[];
}

// ---------------------------------------------------------------------------
// Storage interface
// ---------------------------------------------------------------------------

export interface SessionStorage {
  save(state: SessionState): void;
  load(sessionId: string): SessionState | null;
  list(): string[];
  remove(sessionId: string): boolean;
}

// ---------------------------------------------------------------------------
// File-based storage
// ---------------------------------------------------------------------------

export class FileSessionStorage implements SessionStorage {
  private readonly dir: string;

  constructor(workspaceRoot: string) {
    this.dir = path.join(workspaceRoot, '.agentx', 'sessions');
    fs.mkdirSync(this.dir, { recursive: true });
  }

  private filePath(sessionId: string): string {
    // Sanitize to prevent path traversal
    const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dir, `${safe}.json`);
  }

  save(state: SessionState): void {
    const fp = this.filePath(state.meta.sessionId);
    fs.writeFileSync(fp, JSON.stringify(state, null, 2), 'utf-8');
  }

  load(sessionId: string): SessionState | null {
    const fp = this.filePath(sessionId);
    if (!fs.existsSync(fp)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      return JSON.parse(raw) as SessionState;
    } catch {
      return null;
    }
  }

  list(): string[] {
    try {
      return fs
        .readdirSync(this.dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  remove(sessionId: string): boolean {
    const fp = this.filePath(sessionId);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// In-memory storage (for tests and ephemeral sessions)
// ---------------------------------------------------------------------------

export class InMemorySessionStorage implements SessionStorage {
  private readonly store = new Map<string, SessionState>();

  save(state: SessionState): void {
    // Deep clone to prevent mutation issues
    this.store.set(state.meta.sessionId, JSON.parse(JSON.stringify(state)));
  }

  load(sessionId: string): SessionState | null {
    const state = this.store.get(sessionId);
    if (!state) { return null; }
    return JSON.parse(JSON.stringify(state));
  }

  list(): string[] {
    return [...this.store.keys()];
  }

  remove(sessionId: string): boolean {
    return this.store.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// Session Manager
// ---------------------------------------------------------------------------

/**
 * Manages session lifecycle: creation, message appending, compaction, and
 * persistence. Integrates with the agentic loop to track all conversation
 * turns and tool-call history.
 *
 * Usage:
 * ```ts
 * const manager = new SessionManager(new FileSessionStorage(root));
 * const session = manager.create('engineer', 42);
 * manager.addMessage(session.meta.sessionId, {
 *   role: 'user', content: 'Fix the bug', timestamp: new Date().toISOString()
 * });
 * manager.save(session.meta.sessionId);
 * ```
 */
export class SessionManager {
  private readonly storage: SessionStorage;
  private readonly active = new Map<string, SessionState>();

  /** Default compaction threshold (75% of budget). */
  private static readonly COMPACT_THRESHOLD = 0.75;

  constructor(storage: SessionStorage) {
    this.storage = storage;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Create a new session and hold it in memory. */
  create(agentName: string, issueNumber?: number): SessionState {
    const now = new Date().toISOString();
    const sessionId = `${agentName}-${Date.now()}-${randomSuffix()}`;
    const state: SessionState = {
      meta: {
        sessionId,
        agentName,
        issueNumber,
        createdAt: now,
        updatedAt: now,
        turnCount: 0,
        toolCallCount: 0,
        totalTokensEstimate: 0,
        compacted: false,
      },
      messages: [],
    };
    this.active.set(sessionId, state);
    return state;
  }

  /** Load an existing session from storage into memory. */
  load(sessionId: string): SessionState | null {
    if (this.active.has(sessionId)) {
      return this.active.get(sessionId)!;
    }
    const state = this.storage.load(sessionId);
    if (state) {
      this.active.set(sessionId, state);
    }
    return state;
  }

  /** Persist the current in-memory state to storage. */
  save(sessionId: string): boolean {
    const state = this.active.get(sessionId);
    if (!state) { return false; }
    state.meta.updatedAt = new Date().toISOString();
    this.storage.save(state);
    return true;
  }

  /** Remove a session from memory and storage. */
  remove(sessionId: string): boolean {
    this.active.delete(sessionId);
    return this.storage.remove(sessionId);
  }

  /** List all known session IDs (active + stored). */
  listAll(): string[] {
    const stored = new Set(this.storage.list());
    for (const id of this.active.keys()) {
      stored.add(id);
    }
    return [...stored];
  }

  /** Release a session from active memory (does NOT delete from storage). */
  release(sessionId: string): void {
    this.active.delete(sessionId);
  }

  // -----------------------------------------------------------------------
  // Message management
  // -----------------------------------------------------------------------

  /** Append a message to the session. */
  addMessage(sessionId: string, message: SessionMessage): boolean {
    const state = this.active.get(sessionId);
    if (!state) { return false; }

    state.messages.push(message);
    state.meta.turnCount++;
    state.meta.totalTokensEstimate += estimateTokens(message.content);

    if (message.toolCalls) {
      state.meta.toolCallCount += message.toolCalls.length;
    }

    return true;
  }

  /** Get all messages for a session. */
  getMessages(sessionId: string): readonly SessionMessage[] {
    return this.active.get(sessionId)?.messages ?? [];
  }

  /** Get the last N messages. */
  getRecentMessages(sessionId: string, count: number): readonly SessionMessage[] {
    const msgs = this.active.get(sessionId)?.messages ?? [];
    return msgs.slice(-count);
  }

  // -----------------------------------------------------------------------
  // Compaction
  // -----------------------------------------------------------------------

  /**
   * Compact the session messages when the token budget is being exceeded.
   *
   * Strategy:
   *   1. Keep the system prompt (first message if role=system)
   *   2. Keep the last `keepRecent` messages
   *   3. Summarize everything in between into one compaction message
   *
   * @param sessionId - session to compact
   * @param tokenBudget - total token budget
   * @param keepRecent - number of recent messages to preserve (default 10)
   * @returns true if compaction occurred
   */
  compact(sessionId: string, tokenBudget: number, keepRecent = 10): boolean {
    const state = this.active.get(sessionId);
    if (!state) { return false; }

    const currentTokens = state.meta.totalTokensEstimate;
    if (currentTokens < tokenBudget * SessionManager.COMPACT_THRESHOLD) {
      return false; // No compaction needed
    }

    const msgs = state.messages;
    if (msgs.length <= keepRecent + 1) {
      return false; // Too few messages to compact
    }

    // Partition: system prompt | middle (compactable) | recent
    const systemPrompt = msgs[0]?.role === 'system' ? msgs[0] : null;
    const startIdx = systemPrompt ? 1 : 0;
    const recentStart = Math.max(startIdx, msgs.length - keepRecent);
    const middle = msgs.slice(startIdx, recentStart);
    const recent = msgs.slice(recentStart);

    if (middle.length === 0) {
      return false;
    }

    // Build compaction summary
    const toolCallCount = middle.filter((m) => m.toolCalls?.length).length;
    const toolResultCount = middle.filter((m) => m.role === 'tool').length;
    const summary = [
      `[Session compacted: ${middle.length} messages summarized]`,
      `- ${toolCallCount} tool call(s), ${toolResultCount} tool result(s)`,
      `- Topics: ${extractTopics(middle)}`,
    ].join('\n');

    const compactionMsg: SessionMessage = {
      role: 'system',
      content: summary,
      timestamp: new Date().toISOString(),
    };

    // Rebuild messages array
    const newMessages: SessionMessage[] = [];
    if (systemPrompt) {
      newMessages.push(systemPrompt);
    }
    newMessages.push(compactionMsg);
    newMessages.push(...recent);

    state.messages = newMessages;
    state.meta.totalTokensEstimate = newMessages.reduce(
      (acc, m) => acc + estimateTokens(m.content),
      0,
    );
    state.meta.compacted = true;

    return true;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get session metadata. */
  getMeta(sessionId: string): SessionMeta | null {
    return this.active.get(sessionId)?.meta ?? null;
  }

  /** Check if a session exists (in memory or storage). */
  exists(sessionId: string): boolean {
    return this.active.has(sessionId) || this.storage.load(sessionId) !== null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function extractTopics(messages: readonly SessionMessage[]): string {
  // Simple heuristic: extract first 80 chars of user messages
  const userMsgs = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.slice(0, 80).replace(/\n/g, ' '));

  if (userMsgs.length === 0) {
    return '(no user messages)';
  }
  return userMsgs.slice(0, 3).join('; ');
}
