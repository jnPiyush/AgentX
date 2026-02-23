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
  registerTreeDataProvider: () => ({ dispose: () => { /* noop */ } }),
  createOutputChannel: () => ({
    appendLine: () => { /* noop */ },
    show: () => { /* noop */ },
    dispose: () => { /* noop */ },
  }),
  withProgress: async (_options: unknown, task: (progress: unknown) => Promise<unknown>) => {
    return task({ report: () => { /* noop */ } });
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
  showTextDocument: async (_doc: unknown) => undefined,
};

// --- ProgressLocation enum -----------------------------------------------

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
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

// --- Mock ChatResponseStream ---------------------------------------------

export function createMockResponseStream() {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  return {
    markdown: (...args: unknown[]) => { calls.push({ method: 'markdown', args }); },
    progress: (...args: unknown[]) => { calls.push({ method: 'progress', args }); },
    reference: (...args: unknown[]) => { calls.push({ method: 'reference', args }); },
    button: (...args: unknown[]) => { calls.push({ method: 'button', args }); },
    anchor: (...args: unknown[]) => { calls.push({ method: 'anchor', args }); },
    /** All recorded calls for assertion. */
    calls,
    /** Get all markdown text concatenated. */
    getMarkdown: () => calls
      .filter(c => c.method === 'markdown')
      .map(c => String(c.args[0]))
      .join(''),
  };
}
