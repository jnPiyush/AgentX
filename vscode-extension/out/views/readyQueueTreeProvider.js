"use strict";
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
exports.ReadyQueueTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tree data provider for the Ready Queue sidebar view.
 * Shows priority-sorted unblocked work items.
 */
class ReadyQueueTreeProvider {
    agentx;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    items = [];
    constructor(agentx) {
        this.agentx = agentx;
    }
    refresh() {
        this.items = [];
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren() {
        const initialized = await this.agentx.checkInitialized();
        if (!initialized) {
            return [new ReadyItem('AgentX not initialized', '', 'info')];
        }
        if (this.items.length > 0) {
            return this.items;
        }
        try {
            const output = await this.agentx.runCli('ready');
            if (!output || output.includes('No ')) {
                return [new ReadyItem('No unblocked work', '', 'info')];
            }
            // Parse CLI output lines into tree items
            const lines = output.split('\n').filter(l => l.trim());
            this.items = lines.map(line => {
                const issueMatch = line.match(/#(\d+)/);
                const issueNum = issueMatch ? issueMatch[1] : '';
                return new ReadyItem(line.trim(), issueNum, 'ready');
            });
            return this.items;
        }
        catch {
            return [new ReadyItem('Run "AgentX: Show Ready Queue" to load', '', 'info')];
        }
    }
}
exports.ReadyQueueTreeProvider = ReadyQueueTreeProvider;
class ReadyItem extends vscode.TreeItem {
    issueNumber;
    constructor(label, issueNumber, type) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.issueNumber = issueNumber;
        if (type === 'ready') {
            this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
            this.contextValue = 'readyItem';
        }
        else {
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'infoItem';
        }
    }
}
//# sourceMappingURL=readyQueueTreeProvider.js.map