/**
 * Lightweight VS Code API mock for unit tests.
 *
 * Provides stub implementations of the vscode module surface
 * used by AgentX extension code. Import this in tests rather
 * than depending on the real VS Code runtime.
 */
export declare class Uri {
    readonly scheme: string;
    readonly authority: string;
    readonly path: string;
    readonly fsPath: string;
    private constructor();
    static file(path: string): Uri;
    static parse(value: string): Uri;
    static joinPath(base: Uri, ...pathSegments: string[]): Uri;
}
export declare class EventEmitter<T> {
    private _listeners;
    event: (listener: (e: T) => void) => {
        dispose: () => void;
    };
    fire(data: T): void;
    dispose(): void;
}
export declare enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
}
export declare class TreeItem {
    label?: string;
    description?: string;
    tooltip?: string;
    collapsibleState?: TreeItemCollapsibleState;
    iconPath?: unknown;
    command?: unknown;
    contextValue?: string;
    constructor(label: string, collapsibleState?: TreeItemCollapsibleState);
}
export declare class ThemeIcon {
    readonly id: string;
    constructor(id: string);
}
export declare const workspace: {
    workspaceFolders: Array<{
        uri: Uri;
        name: string;
        index: number;
    }> | undefined;
    getConfiguration: (_section?: string) => {
        get: <T>(key: string, defaultValue?: T) => T;
        update: () => Promise<void>;
        has: () => boolean;
        inspect: () => undefined;
    };
    onDidChangeConfiguration: (_listener: unknown) => {
        dispose: () => void;
    };
    onDidChangeWorkspaceFolders: (_listener: unknown) => {
        dispose: () => void;
    };
    openTextDocument: (_uri: unknown) => Promise<{
        getText: () => string;
    }>;
    createFileSystemWatcher: (_pattern: string) => {
        onDidCreate: () => {
            dispose: () => void;
        };
        onDidChange: () => {
            dispose: () => void;
        };
        onDidDelete: () => {
            dispose: () => void;
        };
        dispose: () => void;
    };
};
/** Test helper: set a mock config value. */
export declare function __setConfig(key: string, value: unknown): void;
/** Test helper: clear all mock config values. */
export declare function __clearConfig(): void;
/** Test helper: set workspace folders. */
export declare function __setWorkspaceFolders(folders: Array<{
    path: string;
    name?: string;
}> | undefined): void;
export declare const window: {
    showInformationMessage: (..._args: unknown[]) => Promise<undefined>;
    showWarningMessage: (..._args: unknown[]) => Promise<undefined>;
    showErrorMessage: (..._args: unknown[]) => Promise<undefined>;
    showQuickPick: (..._args: unknown[]) => Promise<undefined>;
    registerTreeDataProvider: () => {
        dispose: () => void;
    };
    createOutputChannel: (_name?: string) => {
        appendLine: () => void;
        append: () => void;
        clear: () => void;
        show: () => void;
        hide: () => void;
        dispose: () => void;
    };
    withProgress: (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => Promise<unknown>;
    createTerminal: (_options?: unknown) => {
        show: () => void;
        sendText: (_text: string) => void;
        dispose: () => void;
    };
    createStatusBarItem: (_alignment?: unknown, _priority?: number) => {
        text: string;
        tooltip: string;
        command: string;
        show: () => void;
        dispose: () => void;
    };
    showTextDocument: (_doc: unknown) => Promise<undefined>;
};
export declare enum ProgressLocation {
    SourceControl = 1,
    Window = 10,
    Notification = 15
}
export declare enum QuickPickItemKind {
    Separator = -1,
    Default = 0
}
export declare enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
}
export declare const extensions: {
    getExtension: (id: string) => {} | undefined;
};
/** Test helper: register a mock extension. */
export declare function __setExtension(id: string, ext: unknown): void;
/** Test helper: clear all mock extensions. */
export declare function __clearExtensions(): void;
export declare const env: {
    openExternal: (_uri: unknown) => Promise<boolean>;
};
export declare const commands: {
    registerCommand: (_command: string, _callback: (...args: unknown[]) => unknown) => {
        dispose: () => void;
    };
    executeCommand: (..._args: unknown[]) => Promise<undefined>;
};
export declare const chat: {
    createChatParticipant: (_id: string, _handler: unknown) => {
        iconPath: unknown;
        followupProvider: unknown;
    };
};
export declare function createMockResponseStream(): {
    markdown: (...args: unknown[]) => void;
    progress: (...args: unknown[]) => void;
    reference: (...args: unknown[]) => void;
    button: (...args: unknown[]) => void;
    anchor: (...args: unknown[]) => void;
    /** All recorded calls for assertion. */
    calls: {
        method: string;
        args: unknown[];
    }[];
    /** Get all markdown text concatenated. */
    getMarkdown: () => string;
};
//# sourceMappingURL=vscode.d.ts.map