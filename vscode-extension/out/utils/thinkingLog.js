"use strict";
// ---------------------------------------------------------------------------
// AgentX -- Structured Thinking Log
// ---------------------------------------------------------------------------
//
// Records every agent action with timestamps and structured metadata.
// Feeds into the VS Code Output Channel and the event bus for real-time
// visibility into agent behavior.
//
// Inspired by OpenBrowserClaw's thinking-log system.
// ---------------------------------------------------------------------------
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThinkingLog = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Structured thinking log that writes to a VS Code Output Channel
 * and emits events on the AgentEventBus.
 *
 * Usage:
 * ```ts
 * const log = new ThinkingLog(eventBus);
 * log.info('Engineer', 'Starting implementation', 'Issue #42');
 * log.toolCall('Engineer', 'replace_string_in_file', 'src/app.ts L45-50');
 * log.toolResult('Engineer', 'replace_string_in_file', 'Success');
 * log.warning('Engineer', 'Test coverage below 80%', '72% coverage');
 * ```
 */
class ThinkingLog {
    entries = [];
    channel;
    eventBus;
    maxEntries;
    nextId = 1;
    constructor(eventBus, maxEntries = 1000) {
        this.channel = vscode.window.createOutputChannel('AgentX Thinking Log');
        this.eventBus = eventBus;
        this.maxEntries = maxEntries;
    }
    // -----------------------------------------------------------------------
    // Convenience methods
    // -----------------------------------------------------------------------
    info(agent, label, detail) {
        this.log(agent, 'info', label, detail);
    }
    toolCall(agent, tool, detail) {
        this.log(agent, 'tool-call', `Tool: ${tool}`, detail);
    }
    toolResult(agent, tool, detail) {
        this.log(agent, 'tool-result', `Result: ${tool}`, detail);
    }
    apiCall(agent, label, detail) {
        this.log(agent, 'api-call', label, detail);
    }
    text(agent, label, detail) {
        this.log(agent, 'text', label, detail);
    }
    warning(agent, label, detail) {
        this.log(agent, 'warning', label, detail);
    }
    error(agent, label, detail) {
        this.log(agent, 'error', label, detail);
    }
    // -----------------------------------------------------------------------
    // Core logging
    // -----------------------------------------------------------------------
    /**
     * Record a structured log entry.
     */
    log(agent, kind, label, detail) {
        const now = Date.now();
        const entry = {
            id: this.nextId++,
            agent,
            kind,
            label,
            detail,
            timestamp: now,
        };
        // Store in memory
        this.entries.push(entry);
        if (this.entries.length > this.maxEntries) {
            this.entries.shift();
        }
        // Write to VS Code Output Channel
        const time = new Date(now).toISOString().slice(11, 23); // HH:MM:SS.mmm
        const kindTag = `[${kind.toUpperCase()}]`.padEnd(14);
        const line = `${time} ${kindTag} [${agent}] ${label}${detail ? ' -- ' + detail : ''}`;
        this.channel.appendLine(line);
        // Emit on event bus
        if (this.eventBus) {
            this.eventBus.emit('thinking-log', {
                agent,
                kind,
                label,
                detail,
                timestamp: now,
            });
        }
    }
    // -----------------------------------------------------------------------
    // Query
    // -----------------------------------------------------------------------
    /**
     * Get all entries, optionally filtered.
     */
    getEntries(filter) {
        let result = this.entries;
        if (filter?.agent) {
            result = result.filter((e) => e.agent === filter.agent);
        }
        if (filter?.kind) {
            result = result.filter((e) => e.kind === filter.kind);
        }
        if (filter?.since) {
            const since = filter.since;
            result = result.filter((e) => e.timestamp >= since);
        }
        if (filter?.limit !== undefined) {
            result = result.slice(-filter.limit);
        }
        return result;
    }
    /**
     * Get a summary of agent activity counts.
     */
    getSummary() {
        const summary = {};
        for (const entry of this.entries) {
            if (!summary[entry.agent]) {
                summary[entry.agent] = {};
            }
            const agentSummary = summary[entry.agent];
            agentSummary[entry.kind] = (agentSummary[entry.kind] ?? 0) + 1;
        }
        return summary;
    }
    /**
     * Clear all stored entries.
     */
    clear() {
        this.entries.length = 0;
    }
    /**
     * Show the output channel in the VS Code UI.
     */
    show() {
        this.channel.show(true);
    }
    /**
     * Dispose the output channel and clear entries.
     */
    dispose() {
        this.entries.length = 0;
        this.channel.dispose();
    }
}
exports.ThinkingLog = ThinkingLog;
//# sourceMappingURL=thinkingLog.js.map