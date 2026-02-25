"use strict";
/**
 * Lightweight VS Code API mock for unit tests.
 *
 * Provides stub implementations of the vscode module surface
 * used by AgentX extension code. Import this in tests rather
 * than depending on the real VS Code runtime.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = exports.commands = exports.env = exports.extensions = exports.ConfigurationTarget = exports.QuickPickItemKind = exports.ProgressLocation = exports.window = exports.workspace = exports.ThemeIcon = exports.TreeItem = exports.TreeItemCollapsibleState = exports.EventEmitter = exports.Uri = void 0;
exports.__setConfig = __setConfig;
exports.__clearConfig = __clearConfig;
exports.__setWorkspaceFolders = __setWorkspaceFolders;
exports.__setExtension = __setExtension;
exports.__clearExtensions = __clearExtensions;
exports.createMockResponseStream = createMockResponseStream;
// --- Uri -----------------------------------------------------------------
class Uri {
    scheme;
    authority;
    path;
    fsPath;
    constructor(scheme, authority, pth) {
        this.scheme = scheme;
        this.authority = authority;
        this.path = pth;
        this.fsPath = pth;
    }
    static file(path) {
        return new Uri('file', '', path);
    }
    static parse(value) {
        return new Uri('file', '', value);
    }
    static joinPath(base, ...pathSegments) {
        const joined = [base.path, ...pathSegments].join('/');
        return new Uri(base.scheme, base.authority, joined);
    }
}
exports.Uri = Uri;
// --- EventEmitter --------------------------------------------------------
class EventEmitter {
    _listeners = [];
    event = (listener) => {
        this._listeners.push(listener);
        return { dispose: () => { } };
    };
    fire(data) {
        for (const listener of this._listeners) {
            listener(data);
        }
    }
    dispose() {
        this._listeners = [];
    }
}
exports.EventEmitter = EventEmitter;
// --- TreeItem ------------------------------------------------------------
var TreeItemCollapsibleState;
(function (TreeItemCollapsibleState) {
    TreeItemCollapsibleState[TreeItemCollapsibleState["None"] = 0] = "None";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Collapsed"] = 1] = "Collapsed";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Expanded"] = 2] = "Expanded";
})(TreeItemCollapsibleState || (exports.TreeItemCollapsibleState = TreeItemCollapsibleState = {}));
class TreeItem {
    label;
    description;
    tooltip;
    collapsibleState;
    iconPath;
    command;
    contextValue;
    constructor(label, collapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}
exports.TreeItem = TreeItem;
// --- ThemeIcon -----------------------------------------------------------
class ThemeIcon {
    id;
    constructor(id) {
        this.id = id;
    }
}
exports.ThemeIcon = ThemeIcon;
// --- Workspace stubs -----------------------------------------------------
const _configMap = {};
exports.workspace = {
    workspaceFolders: undefined,
    getConfiguration: (_section) => ({
        get: (key, defaultValue) => {
            const fullKey = _section ? `${_section}.${key}` : key;
            return (fullKey in _configMap ? _configMap[fullKey] : defaultValue);
        },
        update: async () => { },
        has: () => false,
        inspect: () => undefined,
    }),
    onDidChangeConfiguration: (_listener) => ({ dispose: () => { } }),
    onDidChangeWorkspaceFolders: (_listener) => ({ dispose: () => { } }),
    openTextDocument: async (_uri) => ({ getText: () => '' }),
    createFileSystemWatcher: (_pattern) => ({
        onDidCreate: () => ({ dispose: () => { } }),
        onDidChange: () => ({ dispose: () => { } }),
        onDidDelete: () => ({ dispose: () => { } }),
        dispose: () => { },
    }),
};
/** Test helper: set a mock config value. */
function __setConfig(key, value) {
    _configMap[key] = value;
}
/** Test helper: clear all mock config values. */
function __clearConfig() {
    for (const k of Object.keys(_configMap)) {
        delete _configMap[k];
    }
}
/** Test helper: set workspace folders. */
function __setWorkspaceFolders(folders) {
    if (!folders) {
        exports.workspace.workspaceFolders = undefined;
        return;
    }
    exports.workspace.workspaceFolders = folders.map((f, i) => ({
        uri: Uri.file(f.path),
        name: f.name ?? f.path.split(/[\\/]/).pop() ?? '',
        index: i,
    }));
}
// --- Window stubs --------------------------------------------------------
exports.window = {
    showInformationMessage: async (..._args) => undefined,
    showWarningMessage: async (..._args) => undefined,
    showErrorMessage: async (..._args) => undefined,
    showQuickPick: async (..._args) => undefined,
    registerTreeDataProvider: () => ({ dispose: () => { } }),
    createOutputChannel: (_name) => ({
        appendLine: () => { },
        append: () => { },
        clear: () => { },
        show: () => { },
        hide: () => { },
        dispose: () => { },
    }),
    withProgress: async (_options, task) => {
        const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => { } }) };
        return task({ report: () => { } }, token);
    },
    createTerminal: (_options) => ({
        show: () => { },
        sendText: (_text) => { },
        dispose: () => { },
    }),
    createStatusBarItem: (_alignment, _priority) => ({
        text: '',
        tooltip: '',
        command: '',
        show: () => { },
        dispose: () => { },
    }),
    showTextDocument: async (_doc) => undefined,
};
// --- ProgressLocation enum -----------------------------------------------
var ProgressLocation;
(function (ProgressLocation) {
    ProgressLocation[ProgressLocation["SourceControl"] = 1] = "SourceControl";
    ProgressLocation[ProgressLocation["Window"] = 10] = "Window";
    ProgressLocation[ProgressLocation["Notification"] = 15] = "Notification";
})(ProgressLocation || (exports.ProgressLocation = ProgressLocation = {}));
// --- QuickPickItemKind enum ----------------------------------------------
var QuickPickItemKind;
(function (QuickPickItemKind) {
    QuickPickItemKind[QuickPickItemKind["Separator"] = -1] = "Separator";
    QuickPickItemKind[QuickPickItemKind["Default"] = 0] = "Default";
})(QuickPickItemKind || (exports.QuickPickItemKind = QuickPickItemKind = {}));
// --- ConfigurationTarget enum --------------------------------------------
var ConfigurationTarget;
(function (ConfigurationTarget) {
    ConfigurationTarget[ConfigurationTarget["Global"] = 1] = "Global";
    ConfigurationTarget[ConfigurationTarget["Workspace"] = 2] = "Workspace";
    ConfigurationTarget[ConfigurationTarget["WorkspaceFolder"] = 3] = "WorkspaceFolder";
})(ConfigurationTarget || (exports.ConfigurationTarget = ConfigurationTarget = {}));
// --- Extensions stubs ----------------------------------------------------
const _extensionMap = {};
exports.extensions = {
    getExtension: (id) => _extensionMap[id] ?? undefined,
};
/** Test helper: register a mock extension. */
function __setExtension(id, ext) {
    _extensionMap[id] = ext;
}
/** Test helper: clear all mock extensions. */
function __clearExtensions() {
    for (const k of Object.keys(_extensionMap)) {
        delete _extensionMap[k];
    }
}
// --- Env stubs -----------------------------------------------------------
exports.env = {
    openExternal: async (_uri) => true,
};
// --- Commands stubs ------------------------------------------------------
exports.commands = {
    registerCommand: (_command, _callback) => ({
        dispose: () => { },
    }),
    executeCommand: async (..._args) => undefined,
};
// --- Chat stubs ----------------------------------------------------------
exports.chat = {
    createChatParticipant: (_id, _handler) => ({
        iconPath: undefined,
        followupProvider: undefined,
    }),
};
// --- Mock ChatResponseStream ---------------------------------------------
function createMockResponseStream() {
    const calls = [];
    return {
        markdown: (...args) => { calls.push({ method: 'markdown', args }); },
        progress: (...args) => { calls.push({ method: 'progress', args }); },
        reference: (...args) => { calls.push({ method: 'reference', args }); },
        button: (...args) => { calls.push({ method: 'button', args }); },
        anchor: (...args) => { calls.push({ method: 'anchor', args }); },
        /** All recorded calls for assertion. */
        calls,
        /** Get all markdown text concatenated. */
        getMarkdown: () => calls
            .filter(c => c.method === 'markdown')
            .map(c => String(c.args[0]))
            .join(''),
    };
}
//# sourceMappingURL=vscode.js.map