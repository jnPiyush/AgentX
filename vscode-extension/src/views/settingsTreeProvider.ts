import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Setting definitions -- the single source of truth for the sidebar panel.
// Each group maps to a VS Code configuration section (e.g. agentx.loop.*).
// ---------------------------------------------------------------------------

interface SettingDef {
  /** VS Code setting key (fully qualified). */
  readonly key: string;
  /** Human-readable label shown in the tree. */
  readonly label: string;
  /** Tooltip / description. */
  readonly tooltip: string;
  /** Default value (must match package.json). */
  readonly defaultValue: number | boolean;
  /** Value type for rendering and editing. Default: 'number'. */
  readonly type?: 'number' | 'boolean';
}

interface SettingGroup {
  readonly label: string;
  readonly icon: string;
  readonly settings: readonly SettingDef[];
}

const SETTING_GROUPS: readonly SettingGroup[] = [
  {
    label: 'Agentic Loop',
    icon: 'symbol-event',
    settings: [
      {
        key: 'agentx.loop.maxIterations',
        label: 'Max Iterations',
        tooltip: 'Maximum tool-call cycles for the main agentic loop',
        defaultValue: 20,
      },
      {
        key: 'agentx.loop.tokenBudget',
        label: 'Token Budget',
        tooltip: 'Token budget for the main agentic loop session',
        defaultValue: 100_000,
      },
    ],
  },
  {
    label: 'Context Management',
    icon: 'archive',
    settings: [
      {
        key: 'agentx.context.autoCompact',
        label: 'Auto Compact',
        tooltip: 'Automatically compact context when approaching token limits',
        defaultValue: true,
        type: 'boolean',
      },
      {
        key: 'agentx.context.maxMessages',
        label: 'Max Messages',
        tooltip: 'Maximum conversation messages before pruning oldest non-system messages',
        defaultValue: 200,
      },
      {
        key: 'agentx.context.compactKeepRecent',
        label: 'Keep Recent Messages',
        tooltip: 'Number of recent messages to preserve during compaction',
        defaultValue: 10,
      },
    ],
  },
  {
    label: 'Self-Review',
    icon: 'checklist',
    settings: [
      {
        key: 'agentx.selfReview.maxIterations',
        label: 'Max Review Rounds',
        tooltip: 'Maximum review-fix-re-review rounds',
        defaultValue: 15,
      },
      {
        key: 'agentx.selfReview.reviewerMaxIterations',
        label: 'Reviewer Max Iterations',
        tooltip: 'Maximum internal iterations for the reviewer sub-agent',
        defaultValue: 8,
      },
      {
        key: 'agentx.selfReview.reviewerTokenBudget',
        label: 'Reviewer Token Budget',
        tooltip: 'Token budget for the reviewer sub-agent during self-review',
        defaultValue: 30_000,
      },
    ],
  },
  {
    label: 'Clarification',
    icon: 'comment-discussion',
    settings: [
      {
        key: 'agentx.clarification.maxIterations',
        label: 'Max Q&A Rounds',
        tooltip: 'Maximum question-answer rounds between agents',
        defaultValue: 6,
      },
      {
        key: 'agentx.clarification.responderMaxIterations',
        label: 'Responder Max Iterations',
        tooltip: 'Maximum internal iterations for the responding sub-agent',
        defaultValue: 5,
      },
      {
        key: 'agentx.clarification.responderTokenBudget',
        label: 'Responder Token Budget',
        tooltip: 'Token budget for the responding sub-agent during clarification',
        defaultValue: 20_000,
      },
    ],
  },
  {
    label: 'Loop Detection',
    icon: 'debug-disconnect',
    settings: [
      {
        key: 'agentx.loopDetection.warningThreshold',
        label: 'Warning Threshold',
        tooltip: 'Consecutive identical tool calls before issuing a warning',
        defaultValue: 10,
      },
      {
        key: 'agentx.loopDetection.circuitBreakerThreshold',
        label: 'Circuit Breaker',
        tooltip: 'Total repeated tool calls before hard-stopping the loop',
        defaultValue: 30,
      },
      {
        key: 'agentx.loopDetection.windowSize',
        label: 'Window Size',
        tooltip: 'Sliding window of recent tool calls to analyze for loop patterns',
        defaultValue: 30,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tree items
// ---------------------------------------------------------------------------

type SettingsNode = SettingGroupItem | SettingValueItem;

class SettingGroupItem extends vscode.TreeItem {
  constructor(readonly group: SettingGroup) {
    super(group.label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(group.icon);
    this.contextValue = 'settingGroup';
  }
}

class SettingValueItem extends vscode.TreeItem {
  constructor(readonly def: SettingDef, currentValue: number | boolean) {
    super(def.label, vscode.TreeItemCollapsibleState.None);
    const isBool = def.type === 'boolean';
    this.description = isBool
      ? (currentValue ? 'Enabled' : 'Disabled')
      : String(currentValue);
    this.tooltip = isBool
      ? `${def.tooltip} (default: ${def.defaultValue ? 'Enabled' : 'Disabled'})`
      : `${def.tooltip} (default: ${def.defaultValue})`;
    this.iconPath = new vscode.ThemeIcon(
      isBool ? (currentValue ? 'pass' : 'circle-slash') : 'symbol-number',
    );
    this.contextValue = 'settingValue';
    this.command = {
      command: 'agentx.editSetting',
      title: 'Edit Setting',
      arguments: [def],
    };
  }
}

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

/**
 * Tree data provider for the Settings sidebar view.
 * Shows agentic loop, self-review, and clarification iteration settings
 * grouped by category. Click a value to edit it inline.
 */
export class SettingsTreeProvider implements vscode.TreeDataProvider<SettingsNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SettingsNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SettingsNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SettingsNode): SettingsNode[] {
    if (!element) {
      // Root -- return groups
      return SETTING_GROUPS.map(g => new SettingGroupItem(g));
    }
    if (element instanceof SettingGroupItem) {
      return element.group.settings.map(s => {
        const current = this.readSetting(s);
        return new SettingValueItem(s, current);
      });
    }
    return [];
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private readSetting(def: SettingDef): number | boolean {
    // Split "agentx.loop.maxIterations" -> section "agentx.loop", key "maxIterations"
    const lastDot = def.key.lastIndexOf('.');
    const section = def.key.slice(0, lastDot);
    const key = def.key.slice(lastDot + 1);
    if (def.type === 'boolean') {
      return vscode.workspace.getConfiguration(section).get<boolean>(key, def.defaultValue as boolean);
    }
    return vscode.workspace.getConfiguration(section).get<number>(key, def.defaultValue as number);
  }
}

// ---------------------------------------------------------------------------
// Edit command -- inline input box for changing a setting value
// ---------------------------------------------------------------------------

/**
 * Register the `agentx.editSetting` command that lets users change a setting
 * value directly from the sidebar via an input box.
 */
export function registerEditSettingCommand(
  context: vscode.ExtensionContext,
  provider: SettingsTreeProvider,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.editSetting', async (def: SettingDef) => {
      if (!def || !def.key) { return; }

      const lastDot = def.key.lastIndexOf('.');
      const section = def.key.slice(0, lastDot);
      const key = def.key.slice(lastDot + 1);

      // Boolean setting -- quick pick toggle
      if (def.type === 'boolean') {
        const current = vscode.workspace.getConfiguration(section).get<boolean>(key, def.defaultValue as boolean);
        const items: vscode.QuickPickItem[] = [
          { label: 'Enabled', description: current ? '(current)' : '' },
          { label: 'Disabled', description: !current ? '(current)' : '' },
        ];
        const pick = await vscode.window.showQuickPick(items, {
          title: def.label,
          placeHolder: def.tooltip,
        });
        if (!pick) { return; }
        const newValue = pick.label === 'Enabled';
        await vscode.workspace.getConfiguration(section).update(key, newValue, vscode.ConfigurationTarget.Workspace);
        provider.refresh();
        return;
      }

      // Numeric setting -- input box
      const current = vscode.workspace.getConfiguration(section).get<number>(key, def.defaultValue as number);

      const input = await vscode.window.showInputBox({
        title: `${def.label}`,
        prompt: def.tooltip,
        value: String(current),
        validateInput: (v) => {
          const n = Number(v);
          if (isNaN(n) || !Number.isInteger(n) || n < 1) {
            return 'Enter a positive integer';
          }
          return undefined;
        },
      });

      if (input === undefined) { return; } // cancelled

      const newValue = Number(input);
      await vscode.workspace.getConfiguration(section).update(key, newValue, vscode.ConfigurationTarget.Workspace);
      provider.refresh();
    }),
  );
}
