/**
 * Lightweight VS Code API mock for unit tests.
 *
 * Provides stub implementations of the vscode module surface
 * used by AgentX extension code. Import this in tests rather
 * than depending on the real VS Code runtime.
 */

// --- Uri -----------------------------------------------------------------

export class Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly fsPath: string;

  private constructor(scheme: string, authority: string, pth: string) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = pth;
    this.fsPath = pth;
  }

  static file(path: string): Uri {
    return new Uri('file', '', path);
  }

  static parse(value: string): Uri {
    return new Uri('file', '', value);
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const joined = [base.path, ...pathSegments].join('/');
    return new Uri(base.scheme, base.authority, joined);
  }
}

// --- EventEmitter --------------------------------------------------------

export class EventEmitter<T> {
  private _listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this._listeners.push(listener);
    return { dispose: () => { /* noop */ } };
  };

  fire(data: T): void {
    for (const listener of this._listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this._listeners = [];
  }
}

// --- TreeItem ------------------------------------------------------------

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label?: string;
  description?: string;
  tooltip?: string;
  collapsibleState?: TreeItemCollapsibleState;
  iconPath?: unknown;
  command?: unknown;
  contextValue?: string;

  constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

// --- ThemeIcon -----------------------------------------------------------

export class ThemeIcon {
  constructor(public readonly id: string, public readonly color?: ThemeColor) {}
}

// --- ThemeColor ----------------------------------------------------------

export class ThemeColor {
  constructor(public readonly id: string) {}
}

// --- Workspace stubs -----------------------------------------------------

const _configMap: Record<string, unknown> = {};

export const workspace = {
  workspaceFolders: undefined as Array<{ uri: Uri; name: string; index: number }> | undefined,

  getConfiguration: (_section?: string) => ({
    get: <T>(key: string, defaultValue?: T): T => {
      const fullKey = _section ? `${_section}.${key}` : key;
      return (fullKey in _configMap ? _configMap[fullKey] : defaultValue) as T;
    },
    update: async () => { /* noop */ },
    has: () => false,
    inspect: () => undefined,
  }),

  onDidChangeConfiguration: (_listener: unknown) => ({ dispose: () => { /* noop */ } }),
  onDidChangeWorkspaceFolders: (_listener: unknown) => ({ dispose: () => { /* noop */ } }),

  openTextDocument: async (_uri: unknown) => ({ getText: () => '' }),

  createFileSystemWatcher: (_pattern: string) => ({
    onDidCreate: () => ({ dispose: () => { /* noop */ } }),
    onDidChange: () => ({ dispose: () => { /* noop */ } }),
    onDidDelete: () => ({ dispose: () => { /* noop */ } }),
    dispose: () => { /* noop */ },
  }),
};

/** Test helper: set a mock config value. */
export function __setConfig(key: string, value: unknown): void {
  _configMap[key] = value;
}

/** Test helper: clear all mock config values. */
export function __clearConfig(): void {
  for (const k of Object.keys(_configMap)) {
    delete _configMap[k];
  }
}

/** Test helper: set workspace folders. */
export function __setWorkspaceFolders(
  folders: Array<{ path: string; name?: string }> | undefined
): void {
  if (!folders) {
    workspace.workspaceFolders = undefined;
    return;
  }
  workspace.workspaceFolders = folders.map((f, i) => ({
    uri: Uri.file(f.path),
    name: f.name ?? f.path.split(/[\\/]/).pop() ?? '',
    index: i,
  }));
}

// --- Window stubs --------------------------------------------------------

export const window = {
  showInformationMessage: async (..._args: unknown[]) => undefined,
  showWarningMessage: async (..._args: unknown[]) => undefined,
  showErrorMessage: async (..._args: unknown[]) => undefined,
  showQuickPick: async (..._args: unknown[]) => undefined,
  showInputBox: async (..._args: unknown[]) => undefined,
  registerTreeDataProvider: () => ({ dispose: () => { /* noop */ } }),
  createOutputChannel: (_name?: string) => ({
    appendLine: () => { /* noop */ },
    append: () => { /* noop */ },
    clear: () => { /* noop */ },
    show: () => { /* noop */ },
    hide: () => { /* noop */ },
    dispose: () => { /* noop */ },
  }),
  withProgress: async (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
    const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => { /* noop */ } }) };
    return task({ report: () => { /* noop */ } }, token);
  },
  createTerminal: (_options?: unknown) => ({
    show: () => { /* noop */ },
    sendText: (_text: string) => { /* noop */ },
    dispose: () => { /* noop */ },
  }),
  createStatusBarItem: (_alignment?: unknown, _priority?: number) => ({
    text: '',
    tooltip: '',
    command: '',
    show: () => { /* noop */ },
    dispose: () => { /* noop */ },
  }),
  createWebviewPanel: (_viewType: string, _title: string, _showOptions: unknown, _options?: unknown) => ({
    webview: {
      html: '',
      onDidReceiveMessage: () => ({ dispose: () => { /* noop */ } }),
      postMessage: async () => true,
    },
    reveal: () => { /* noop */ },
    dispose: () => { /* noop */ },
    onDidDispose: () => ({ dispose: () => { /* noop */ } }),
  }),
  showTextDocument: async (_doc: unknown) => undefined,
};

// --- ProgressLocation enum -----------------------------------------------

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

// --- ViewColumn enum -----------------------------------------------------

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

// --- QuickPickItemKind enum ----------------------------------------------

export enum QuickPickItemKind {
  Separator = -1,
  Default = 0,
}

// --- ConfigurationTarget enum --------------------------------------------

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

// --- Extensions stubs ----------------------------------------------------

const _extensionMap: Record<string, unknown> = {};

export const extensions = {
  getExtension: (id: string) => _extensionMap[id] ?? undefined,
};

/** Test helper: register a mock extension. */
export function __setExtension(id: string, ext: unknown): void {
  _extensionMap[id] = ext;
}

/** Test helper: clear all mock extensions. */
export function __clearExtensions(): void {
  for (const k of Object.keys(_extensionMap)) {
    delete _extensionMap[k];
  }
}

// --- Env stubs -----------------------------------------------------------

export const env = {
  openExternal: async (_uri: unknown) => true,
};

// --- Commands stubs ------------------------------------------------------

export const commands = {
  registerCommand: (_command: string, _callback: (...args: unknown[]) => unknown) => ({
    dispose: () => { /* noop */ },
  }),
  executeCommand: async (..._args: unknown[]) => undefined,
};

// --- Chat stubs ----------------------------------------------------------

export const chat = {
  createChatParticipant: (_id: string, _handler: unknown) => ({
    iconPath: undefined as unknown,
    followupProvider: undefined as unknown,
  }),
};

// --- Language Model stubs ------------------------------------------------

/** Mock LanguageModelChat instance. */
export interface MockLanguageModelChat {
  readonly name: string;
  readonly family: string;
  readonly vendor: string;
  /** Maximum input tokens the model supports (context window). */
  readonly maxInputTokens?: number;
  /** Send a chat request to the mock model. */
  sendRequest?(messages: unknown[], options?: unknown, token?: unknown): Promise<unknown>;
}

/** Configurable model inventory for tests. */
let _mockModels: MockLanguageModelChat[] = [];

export const lm = {
  selectChatModels: async (
    selector?: { family?: string; vendor?: string },
  ): Promise<MockLanguageModelChat[]> => {
    if (!selector) { return [..._mockModels]; }
    return _mockModels.filter((m) => {
      if (selector.family && m.family !== selector.family) { return false; }
      if (selector.vendor && m.vendor !== selector.vendor) { return false; }
      return true;
    });
  },
};

/** Test helper: set available mock models. */
export function __setMockModels(models: MockLanguageModelChat[]): void {
  _mockModels = [...models];
}

/** Test helper: clear all mock models. */
export function __clearMockModels(): void {
  _mockModels = [];
}

// --- Additional Missing APIs (from lessons learned audit) ----------------

// CancellationToken and related
export class CancellationTokenSource {
  token: CancellationToken;
  constructor() {
    this.token = new CancellationToken();
  }
  cancel(): void { /* noop */ }
  dispose(): void { /* noop */ }
}

export class CancellationToken {
  isCancellationRequested = false;
  onCancellationRequested = () => ({ dispose: () => { /* noop */ } });
}

// Disposable
export class Disposable {
  constructor(private _callOnDispose: () => void) {}
  dispose(): void {
    this._callOnDispose();
  }
  static from(...disposables: { dispose(): unknown }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach(d => d.dispose());
    });
  }
}

// Chat-related types
export interface ChatContext {
  readonly history: ChatRequestTurn[];
}

export interface ChatRequestTurn {
  readonly prompt: string;
  readonly response: unknown;
}

export interface ChatRequest {
  readonly prompt: string;
  readonly references: readonly ChatReference[];
  readonly location: ChatLocation;
  readonly attempt: number;
}

export interface ChatReference {
  readonly id: string;
  readonly value: unknown;
}

export enum ChatLocation {
  Panel = 1,
  Terminal = 2,
  Notebook = 3,
  Editor = 4
}

export interface ChatFollowup {
  readonly prompt: string;
  readonly label?: string;
  readonly tooltip?: string;
}

export interface ChatResult {
  readonly errorDetails?: {
    readonly message: string;
    readonly cause?: Error;
  };
}

export type ChatRequestHandler = (
  request: ChatRequest,
  context: ChatContext,
  stream: ChatResponseStream,
  token: CancellationToken
) => ProviderResult<ChatResult>;

export type ChatFollowupProvider = (
  result: ChatResult,
  context: ChatContext,
  token: CancellationToken
) => ProviderResult<ChatFollowup[]>;

export interface ChatResponseStream {
  markdown(value: string): void;
  progress(value: string): void;
  reference(value: unknown, iconPath?: unknown): void;
  button(command: unknown): void;
  anchor(value: unknown, title?: string): void;
}

// Language Model Chat types
export class LanguageModelChatMessage {
  static User(content: string): LanguageModelChatMessage {
    return new LanguageModelChatMessage('user', content);
  }
  static Assistant(content: string): LanguageModelChatMessage {  
    return new LanguageModelChatMessage('assistant', content);
  }
  
  constructor(public role: string, public content: string) {}
}

export interface LanguageModelChat {
  readonly name: string;
  readonly family: string;
  readonly id: string;
  readonly vendor: string;
  readonly version?: string;
  readonly maxInputTokens?: number;
  countTokens(text: string, token?: CancellationToken): Thenable<number>;
  sendRequest(messages: LanguageModelChatMessage[], options?: unknown, token?: CancellationToken): Thenable<unknown>;
}

// Status Bar Alignment
export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

// Provider Result type
export type ProviderResult<T> = T | undefined | null | Promise<T | undefined | null>;

// Memento (storage interface)
export interface Memento {
  keys(): readonly string[];
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Promise<void>;
}

// OutputChannel
export interface OutputChannel {
  readonly name: string;
  append(value: string): void;
  appendLine(value: string): void;
  clear(): void;
  show(column?: ViewColumn, preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

// ExtensionContext
export interface ExtensionContext {
  subscriptions: { dispose(): unknown }[];
  workspaceState: Memento;
  globalState: Memento;
  secrets: unknown;
  extensionUri: Uri;
  extensionPath: string;
  globalStorageUri: Uri;
  logUri: Uri;
  storageUri: Uri | undefined;
  extensionMode: unknown;
}

// TreeDataProvider
export interface TreeDataProvider<T> {
  onDidChangeTreeData?: (listener: (e: T | undefined | null) => unknown) => Disposable;
  getTreeItem(element: T): TreeItem | Thenable<TreeItem>;
  getChildren(element?: T): ProviderResult<T[]>;
  getParent?(element: T): ProviderResult<T>;
}

// QuickPickItem
export interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
  kind?: QuickPickItemKind;
}

// Webview
export interface Webview {
  readonly options: unknown;
  readonly cspSource: string;
  html: string;
  onDidReceiveMessage: (listener: (message: unknown) => unknown) => Disposable;
  postMessage(message: unknown): Promise<boolean>;
  asWebviewUri(localResource: Uri): Uri;
}

// WebviewPanel
export interface WebviewPanel {
  readonly viewType: string;
  title: string;
  readonly webview: Webview;
  readonly options: unknown;
  readonly viewColumn: ViewColumn | undefined;
  readonly visible: boolean;
  readonly active: boolean;
  onDidDispose: (listener: () => unknown) => Disposable;
  onDidChangeViewState: (listener: (e: unknown) => unknown) => Disposable;
  reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;
  dispose(): void;
}

// --- Mock ChatResponseStream ---------------------------------------------

/** Extended mock stream with test assertion helpers. */
export interface MockChatResponseStream extends ChatResponseStream {
  /** All recorded calls for assertion. */
  calls: Array<{ method: string; args: unknown[] }>;
  /** Get all markdown text concatenated. */
  getMarkdown(): string;
}

export function createMockResponseStream(): MockChatResponseStream {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  return {
    markdown: (...args: unknown[]) => { calls.push({ method: 'markdown', args }); },
    progress: (...args: unknown[]) => { calls.push({ method: 'progress', args }); },
    reference: (...args: unknown[]) => { calls.push({ method: 'reference', args }); },
    button: (...args: unknown[]) => { calls.push({ method: 'button', args }); },
    anchor: (...args: unknown[]) => { calls.push({ method: 'anchor', args }); },
    calls,
    getMarkdown: () => calls
      .filter(c => c.method === 'markdown')
      .map(c => String(c.args[0]))
      .join(''),
  };
}
