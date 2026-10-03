export interface InteractionPlan {
  readonly sessionId: string;
  readonly workspaceRoot: string;
  readonly agent: string;
  readonly engine: 'native';
  readonly mode: 'guided';
  readonly version: number;
  readonly goal: string;
  readonly scope: string[];
  readonly nonGoals: string[];
  readonly assumptions: string[];
  readonly steps: Array<{ id: string; title: string; verification: string }>;
}

interface PendingInteractionBase {
  readonly sessionId: string;
  readonly agent: string;
  readonly inputId: string;
  readonly phase: string;
  readonly message: string;
}

export type PendingInteraction =
  | (PendingInteractionBase & {
    readonly kind: 'plan';
    readonly planVersion: number;
    readonly digest: string;
    readonly plan: InteractionPlan;
  })
  | (PendingInteractionBase & {
    readonly kind: 'question';
    readonly question: string;
    readonly choices: string[];
  });

export interface PendingClarificationState {
  sessionId: string;
  agentName: string;
  prompt: string;
  humanPrompt?: string;
  fromAgent?: string;
  targetAgent?: string;
  topic?: string;
  status?: string;
  exchangeCount?: number;
  interaction?: PendingInteraction;
}

export interface PendingSetupState {
  kind: 'llm-adapter' | 'remote-adapter';
  step: 'choose-llm-provider' | 'choose-remote-adapter' | 'enter-github-repo' | 'enter-ado-project';
  prompt: string;
  providerId?: 'copilot' | 'claude-code' | 'anthropic-api' | 'openai-api';
  adapterMode?: 'github' | 'ado' | 'local';
  detectedValue?: string;
}

export interface AgentBoundaries {
  readonly canModify: string[];
  readonly cannotModify: string[];
}

export interface AgentDefinition {
  name?: string;
  description: string;
  model: string;
  visibility?: 'public' | 'internal';
  constraints?: string[];
  boundaries?: AgentBoundaries;
  fileName: string;
  tools?: string[];
  agents?: string[];
}