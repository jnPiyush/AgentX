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

import { AgentEventBus } from './eventBus';

// ---------------------------------------------------------------------------
// Channel interface
// ---------------------------------------------------------------------------

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
export class ChannelRouter {
  private readonly channels = new Map<string, Channel>();
  private readonly messageCallbacks: Array<(msg: ChannelMessage) => void> = [];
  private readonly eventBus: AgentEventBus | undefined;

  constructor(eventBus?: AgentEventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Register a channel. Its `id` is used as the prefix for routing.
   */
  register(channel: Channel): void {
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
        } catch (err) {
          console.error(`ChannelRouter: message callback error:`, err);
        }
      }
    });
  }

  /**
   * Unregister a channel by its ID.
   */
  unregister(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.stop();
      this.channels.delete(channelId);
    }
  }

  /**
   * Send a response to the correct channel based on groupId prefix.
   */
  async send(groupId: string, response: ChannelResponse): Promise<void> {
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
  setTyping(groupId: string, typing: boolean): void {
    const channel = this.findChannel(groupId);
    channel?.setTyping(groupId, typing);
  }

  /**
   * Register a callback for messages from any channel.
   */
  onMessage(callback: (msg: ChannelMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Get all registered channel IDs.
   */
  getChannelIds(): string[] {
    return [...this.channels.keys()];
  }

  /**
   * Get a specific channel by ID.
   */
  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Start all registered channels.
   */
  async startAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      await channel.start();
    }
  }

  /**
   * Stop all registered channels and clear registrations.
   */
  stopAll(): void {
    for (const channel of this.channels.values()) {
      channel.stop();
    }
    this.channels.clear();
    this.messageCallbacks.length = 0;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private findChannel(groupId: string): Channel | undefined {
    const colonIdx = groupId.indexOf(':');
    if (colonIdx < 0) {
      // No prefix -- try default channel 'vsc'
      return this.channels.get('vsc') ?? this.channels.values().next().value;
    }
    const prefix = groupId.slice(0, colonIdx);
    return this.channels.get(prefix);
  }
}

// ---------------------------------------------------------------------------
// VS Code Chat Channel (built-in default)
// ---------------------------------------------------------------------------

/**
 * Channel implementation for VS Code Copilot Chat.
 *
 * This is the primary built-in channel. Messages are routed through
 * the VS Code Chat Participant API.
 */
export class VsCodeChatChannel implements Channel {
  readonly id = 'vsc';
  readonly name = 'VS Code Chat';

  private messageHandlers: Array<(msg: ChannelMessage) => void> = [];
  private active = true;

  isActive(): boolean {
    return this.active;
  }

  async send(_groupId: string, _response: ChannelResponse): Promise<void> {
    // VS Code Chat sends responses via ChatResponseStream,
    // which is handled at the chatParticipant level.
    // This method exists for interface compliance and future use.
  }

  setTyping(_groupId: string, _typing: boolean): void {
    // VS Code Chat handles progress indicators via response.progress()
  }

  onMessage(callback: (msg: ChannelMessage) => void): void {
    this.messageHandlers.push(callback);
  }

  /**
   * Called by chatParticipant when a message is received.
   */
  receiveMessage(msg: ChannelMessage): void {
    for (const handler of this.messageHandlers) {
      handler(msg);
    }
  }

  async start(): Promise<void> {
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.messageHandlers = [];
  }
}

// ---------------------------------------------------------------------------
// CLI Channel
// ---------------------------------------------------------------------------

/**
 * Channel implementation for the AgentX CLI (terminal).
 *
 * Messages come from CLI commands. Responses are written to stdout
 * via the VS Code terminal.
 */
export class CliChannel implements Channel {
  readonly id = 'cli';
  readonly name = 'CLI Terminal';

  private messageHandlers: Array<(msg: ChannelMessage) => void> = [];
  private active = true;

  isActive(): boolean {
    return this.active;
  }

  async send(_groupId: string, _response: ChannelResponse): Promise<void> {
    // CLI output is handled by the command execution layer.
  }

  setTyping(_groupId: string, _typing: boolean): void {
    // No typing indicator in CLI
  }

  onMessage(callback: (msg: ChannelMessage) => void): void {
    this.messageHandlers.push(callback);
  }

  /**
   * Called when a CLI command is invoked.
   */
  receiveMessage(msg: ChannelMessage): void {
    for (const handler of this.messageHandlers) {
      handler(msg);
    }
  }

  async start(): Promise<void> {
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.messageHandlers = [];
  }
}

// ---------------------------------------------------------------------------
// GitHub Issue Channel (stub for future implementation)
// ---------------------------------------------------------------------------

/**
 * Channel stub for GitHub Issue comments.
 *
 * In a future version, this channel will allow agents to post comments
 * directly on GitHub issues and respond to issue-based triggers.
 */
export class GitHubIssueChannel implements Channel {
  readonly id = 'gh';
  readonly name = 'GitHub Issues';

  private messageHandlers: Array<(msg: ChannelMessage) => void> = [];
  private active = false;

  isActive(): boolean {
    return this.active;
  }

  async send(_groupId: string, _response: ChannelResponse): Promise<void> {
    // Future: Use GitHub API to post issue comments
    console.warn('GitHubIssueChannel.send() is not yet implemented.');
  }

  setTyping(_groupId: string, _typing: boolean): void {
    // No typing indicator for GitHub Issues
  }

  onMessage(callback: (msg: ChannelMessage) => void): void {
    this.messageHandlers.push(callback);
  }

  async start(): Promise<void> {
    // Future: Set up webhook listener or polling
    this.active = false;
  }

  stop(): void {
    this.active = false;
    this.messageHandlers = [];
  }
}
