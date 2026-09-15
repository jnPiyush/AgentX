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