"use strict";
// ---------------------------------------------------------------------------
// AgentX -- Channel Abstraction
// ---------------------------------------------------------------------------
//
// Defines a Channel interface for multi-surface message routing.
// Each surface (VS Code Chat, CLI, GitHub Issues, etc.) implements the
// interface and registers with the ChannelRouter.
//
// Inspired by OpenBrowserClaw's Router + Channel pattern.
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubIssueChannel = exports.CliChannel = exports.VsCodeChatChannel = exports.ChannelRouter = void 0;
// ---------------------------------------------------------------------------
// Channel Router
// ---------------------------------------------------------------------------
/**
 * Routes messages to the correct channel based on group ID prefix.
 *
 * Prefix convention:
 *   "vsc:"  -> VS Code Chat channel
 *   "cli:"  -> CLI terminal channel
 *   "gh:"   -> GitHub Issues channel
 *
 * Usage:
 * ```ts
 * const router = new ChannelRouter(eventBus);
 * router.register(new VsCodeChatChannel());
 * router.register(new CliChannel());
 *
 * await router.send('vsc:main', { content: 'Hello from AgentX' });
 * ```
 */
class ChannelRouter {
    channels = new Map();
    messageCallbacks = [];
    eventBus;
    constructor(eventBus) {
        this.eventBus = eventBus;
    }
    /**
     * Register a channel. Its `id` is used as the prefix for routing.
     */
    register(channel) {
        this.channels.set(channel.id, channel);
        // Wire up message forwarding
        channel.onMessage((msg) => {
            // Emit on event bus
            if (this.eventBus) {
                this.eventBus.emit('channel-message', {
                    channelId: channel.id,
                    direction: 'inbound',
                    content: msg.content,
                    timestamp: msg.timestamp,
                });
            }
            // Forward to all registered callbacks
            for (const cb of this.messageCallbacks) {
                try {
                    cb(msg);
                }
                catch (err) {
                    console.error(`ChannelRouter: message callback error:`, err);
                }
            }
        });
    }
    /**
     * Unregister a channel by its ID.
     */
    unregister(channelId) {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.stop();
            this.channels.delete(channelId);
        }
    }
    /**
     * Send a response to the correct channel based on groupId prefix.
     */
    async send(groupId, response) {
        const channel = this.findChannel(groupId);
        if (!channel) {
            console.warn(`ChannelRouter: no channel for groupId '${groupId}'`);
            return;
        }
        await channel.send(groupId, response);
        // Emit on event bus
        if (this.eventBus) {
            this.eventBus.emit('channel-message', {
                channelId: channel.id,
                direction: 'outbound',
                content: response.content,
                timestamp: Date.now(),
            });
        }
    }
    /**
     * Set typing indicator on the correct channel.
     */
    setTyping(groupId, typing) {
        const channel = this.findChannel(groupId);
        channel?.setTyping(groupId, typing);
    }
    /**
     * Register a callback for messages from any channel.
     */
    onMessage(callback) {
        this.messageCallbacks.push(callback);
    }
    /**
     * Get all registered channel IDs.
     */
    getChannelIds() {
        return [...this.channels.keys()];
    }
    /**
     * Get a specific channel by ID.
     */
    getChannel(channelId) {
        return this.channels.get(channelId);
    }
    /**
     * Start all registered channels.
     */
    async startAll() {
        for (const channel of this.channels.values()) {
            await channel.start();
        }
    }
    /**
     * Stop all registered channels and clear registrations.
     */
    stopAll() {
        for (const channel of this.channels.values()) {
            channel.stop();
        }
        this.channels.clear();
        this.messageCallbacks.length = 0;
    }
    // -----------------------------------------------------------------------
    // Private
    // -----------------------------------------------------------------------
    findChannel(groupId) {
        const colonIdx = groupId.indexOf(':');
        if (colonIdx < 0) {
            // No prefix -- try default channel 'vsc'
            return this.channels.get('vsc') ?? this.channels.values().next().value;
        }
        const prefix = groupId.slice(0, colonIdx);
        return this.channels.get(prefix);
    }
}
exports.ChannelRouter = ChannelRouter;
// ---------------------------------------------------------------------------
// VS Code Chat Channel (built-in default)
// ---------------------------------------------------------------------------
/**
 * Channel implementation for VS Code Copilot Chat.
 *
 * This is the primary built-in channel. Messages are routed through
 * the VS Code Chat Participant API.
 */
class VsCodeChatChannel {
    id = 'vsc';
    name = 'VS Code Chat';
    messageHandlers = [];
    active = true;
    isActive() {
        return this.active;
    }
    async send(_groupId, _response) {
        // VS Code Chat sends responses via ChatResponseStream,
        // which is handled at the chatParticipant level.
        // This method exists for interface compliance and future use.
    }
    setTyping(_groupId, _typing) {
        // VS Code Chat handles progress indicators via response.progress()
    }
    onMessage(callback) {
        this.messageHandlers.push(callback);
    }
    /**
     * Called by chatParticipant when a message is received.
     */
    receiveMessage(msg) {
        for (const handler of this.messageHandlers) {
            handler(msg);
        }
    }
    async start() {
        this.active = true;
    }
    stop() {
        this.active = false;
        this.messageHandlers = [];
    }
}
exports.VsCodeChatChannel = VsCodeChatChannel;
// ---------------------------------------------------------------------------
// CLI Channel
// ---------------------------------------------------------------------------
/**
 * Channel implementation for the AgentX CLI (terminal).
 *
 * Messages come from CLI commands. Responses are written to stdout
 * via the VS Code terminal.
 */
class CliChannel {
    id = 'cli';
    name = 'CLI Terminal';
    messageHandlers = [];
    active = true;
    isActive() {
        return this.active;
    }
    async send(_groupId, _response) {
        // CLI output is handled by the command execution layer.
    }
    setTyping(_groupId, _typing) {
        // No typing indicator in CLI
    }
    onMessage(callback) {
        this.messageHandlers.push(callback);
    }
    /**
     * Called when a CLI command is invoked.
     */
    receiveMessage(msg) {
        for (const handler of this.messageHandlers) {
            handler(msg);
        }
    }
    async start() {
        this.active = true;
    }
    stop() {
        this.active = false;
        this.messageHandlers = [];
    }
}
exports.CliChannel = CliChannel;
// ---------------------------------------------------------------------------
// GitHub Issue Channel (stub for future implementation)
// ---------------------------------------------------------------------------
/**
 * Channel stub for GitHub Issue comments.
 *
 * In a future version, this channel will allow agents to post comments
 * directly on GitHub issues and respond to issue-based triggers.
 */
class GitHubIssueChannel {
    id = 'gh';
    name = 'GitHub Issues';
    messageHandlers = [];
    active = false;
    isActive() {
        return this.active;
    }
    async send(_groupId, _response) {
        // Future: Use GitHub API to post issue comments
        console.warn('GitHubIssueChannel.send() is not yet implemented.');
    }
    setTyping(_groupId, _typing) {
        // No typing indicator for GitHub Issues
    }
    onMessage(callback) {
        this.messageHandlers.push(callback);
    }
    async start() {
        // Future: Set up webhook listener or polling
        this.active = false;
    }
    stop() {
        this.active = false;
        this.messageHandlers = [];
    }
}
exports.GitHubIssueChannel = GitHubIssueChannel;
//# sourceMappingURL=channelRouter.js.map