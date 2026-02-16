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
exports.WorkflowTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Tree data provider for the Workflows sidebar view.
 * Shows available TOML workflow templates.
 */
class WorkflowTreeProvider {
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
    async getChildren() {
        const root = this.agentx.workspaceRoot;
        if (!root) {
            return [];
        }
        const workflowsDir = path.join(root, '.agentx', 'workflows');
        if (!fs.existsSync(workflowsDir)) {
            return [new WorkflowItem('No workflows found', '', 'info')];
        }
        const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.toml'));
        if (files.length === 0) {
            return [new WorkflowItem('No workflows found', '', 'info')];
        }
        const icons = {
            feature: 'git-pull-request',
            epic: 'layers',
            story: 'note',
            bug: 'bug',
            spike: 'beaker',
            devops: 'server-process',
            docs: 'book',
        };
        return files.map(f => {
            const name = f.replace('.toml', '');
            const iconId = icons[name] || 'file';
            const filePath = path.join(workflowsDir, f);
            return new WorkflowItem(name, filePath, 'workflow', iconId);
        });
    }
}
exports.WorkflowTreeProvider = WorkflowTreeProvider;
class WorkflowItem extends vscode.TreeItem {
    constructor(label, filePath, type, iconId) {
        super(label, vscode.TreeItemCollapsibleState.None);
        if (type === 'workflow') {
            this.iconPath = new vscode.ThemeIcon(iconId || 'file');
            this.contextValue = 'workflowItem';
            this.command = {
                command: 'vscode.open',
                title: 'Open Workflow',
                arguments: [vscode.Uri.file(filePath)],
            };
            this.tooltip = `Open ${label} workflow`;
        }
        else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}
//# sourceMappingURL=workflowTreeProvider.js.map