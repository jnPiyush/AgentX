import { AgentEventBus } from './eventBus';
/**
 * Inbound message from any channel.
 */
export interface ChannelMessage {
    readonly id: string;
    readonly channelId: string;
    readonly sender: string;
    readonly content: string;
    readonly timestamp: number;
    readonly metadata?: Record<string, unknown>;
}
/**
 * Response to be sent back through a channel.
 */
export interface ChannelResponse {
    readonly content: string;
    readonly metadata?: Record<string, unknown>;
}
/**
 * A communication channel that can receive and send messages.
 *
 * Implement this interface for each surface:
 * - VsCodeChatChannel  (VS Code Copilot Chat)
 * - CliChannel          (terminal CLI)
 * - GitHubIssueChannel  (GitHub issue comments)
 * - SlackChannel         (future)
 */
export interface Channel {
    /** Unique identifier for this channel (e.g., 'vsc', 'cli', 'gh'). */
    readonly id: string;
    /** Human-readable name (e.g., 'VS Code Chat'). */
    readonly name: string;
    /** Whether this channel is currently active/connected. */
    isActive(): boolean;
    /**
     * Send a response message through this channel.
     */
    send(groupId: string, response: ChannelResponse): Promise<void>;
    /**
     * Set typing/activity indicator on this channel.
     */
    setTyping(groupId: string, typing: boolean): void;
    /**
     * Register a callback for incoming messages.
     */
    onMessage(callback: (msg: ChannelMessage) => void): void;
    /**
     * Start listening for messages (if applicable).
     */
    start(): Promise<void>;
    /**
     * Stop listening and clean up resources.
     */
    stop(): void;
}
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
export declare class ChannelRouter {
    private readonly channels;
    private readonly messageCallbacks;
    private readonly eventBus;
    constructor(eventBus?: AgentEventBus);
    /**
     * Register a channel. Its `id` is used as the prefix for routing.
     */
    register(channel: Channel): void;
    /**
     * Unregister a channel by its ID.
     */
    unregister(channelId: string): void;
    /**
     * Send a response to the correct channel based on groupId prefix.
     */
    send(groupId: string, response: ChannelResponse): Promise<void>;
    /**
     * Set typing indicator on the correct channel.
     */
    setTyping(groupId: string, typing: boolean): void;
    /**
     * Register a callback for messages from any channel.
     */
    onMessage(callback: (msg: ChannelMessage) => void): void;
    /**
     * Get all registered channel IDs.
     */
    getChannelIds(): string[];
    /**
     * Get a specific channel by ID.
     */
    getChannel(channelId: string): Channel | undefined;
    /**
     * Start all registered channels.
     */
    startAll(): Promise<void>;
    /**
     * Stop all registered channels and clear registrations.
     */
    stopAll(): void;
    private findChannel;
}
/**
 * Channel implementation for VS Code Copilot Chat.
 *
 * This is the primary built-in channel. Messages are routed through
 * the VS Code Chat Participant API.
 */
export declare class VsCodeChatChannel implements Channel {
    readonly id = "vsc";
    readonly name = "VS Code Chat";
    private messageHandlers;
    private active;
    isActive(): boolean;
    send(_groupId: string, _response: ChannelResponse): Promise<void>;
    setTyping(_groupId: string, _typing: boolean): void;
    onMessage(callback: (msg: ChannelMessage) => void): void;
    /**
     * Called by chatParticipant when a message is received.
     */
    receiveMessage(msg: ChannelMessage): void;
    start(): Promise<void>;
    stop(): void;
}
/**
 * Channel implementation for the AgentX CLI (terminal).
 *
 * Messages come from CLI commands. Responses are written to stdout
 * via the VS Code terminal.
 */
export declare class CliChannel implements Channel {
    readonly id = "cli";
    readonly name = "CLI Terminal";
    private messageHandlers;
    private active;
    isActive(): boolean;
    send(_groupId: string, _response: ChannelResponse): Promise<void>;
    setTyping(_groupId: string, _typing: boolean): void;
    onMessage(callback: (msg: ChannelMessage) => void): void;
    /**
     * Called when a CLI command is invoked.
     */
    receiveMessage(msg: ChannelMessage): void;
    start(): Promise<void>;
    stop(): void;
}
/**
 * Channel stub for GitHub Issue comments.
 *
 * In a future version, this channel will allow agents to post comments
 * directly on GitHub issues and respond to issue-based triggers.
 */
export declare class GitHubIssueChannel implements Channel {
    readonly id = "gh";
    readonly name = "GitHub Issues";
    private messageHandlers;
    private active;
    isActive(): boolean;
    send(_groupId: string, _response: ChannelResponse): Promise<void>;
    setTyping(_groupId: string, _typing: boolean): void;
    onMessage(callback: (msg: ChannelMessage) => void): void;
    start(): Promise<void>;
    stop(): void;
}
//# sourceMappingURL=channelRouter.d.ts.map