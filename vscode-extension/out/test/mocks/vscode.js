"use strict";
/**
 * Lightweight VS Code API mock for unit tests.
 *
 * Provides stub implementations of the vscode module surface
 * used by AgentX extension code. Import this in tests rather
 * than depending on the real VS Code runtime.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = exports.commands = exports.window = exports.workspace = exports.ThemeIcon = exports.TreeItem = exports.TreeItemCollapsibleState = exports.EventEmitter = exports.Uri = void 0;
exports.__setConfig = __setConfig;
exports.__clearConfig = __clearConfig;
exports.__setWorkspaceFolders = __setWorkspaceFolders;
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
    createOutputChannel: () => ({
        appendLine: () => { },
        show: () => { },
        dispose: () => { },
    }),
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