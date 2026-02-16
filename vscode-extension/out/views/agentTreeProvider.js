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
exports.AgentTreeItem = exports.AgentTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tree data provider for the Agents sidebar view.
 * Shows all agent definitions with their model, maturity, and status.
 */
class AgentTreeProvider {
    agentx;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(agentx) {
        this.agentx = agentx;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            // Child items: show details
            return element.children || [];
        }
        const initialized = await this.agentx.checkInitialized();
        if (!initialized) {
            return [];
        }
        const agents = await this.agentx.listAgents();
        return agents.map(a => this.createAgentItem(a));
    }
    createAgentItem(agent) {
        const item = new AgentTreeItem(agent.name, vscode.TreeItemCollapsibleState.Collapsed, agent);
        item.tooltip = agent.description;
        item.contextValue = 'agent';
        // Children with details
        item.children = [
            new AgentTreeItem(`Model: ${agent.model}`, vscode.TreeItemCollapsibleState.None),
            new AgentTreeItem(`Maturity: ${agent.maturity}`, vscode.TreeItemCollapsibleState.None),
            new AgentTreeItem(`Mode: ${agent.mode}`, vscode.TreeItemCollapsibleState.None),
        ];
        return item;
    }
}
exports.AgentTreeProvider = AgentTreeProvider;
class AgentTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    agent;
    children;
    constructor(label, collapsibleState, agent) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.agent = agent;
    }
}
exports.AgentTreeItem = AgentTreeItem;
//# sourceMappingURL=agentTreeProvider.js.map