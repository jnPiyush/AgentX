// ---------------------------------------------------------------------------
// AgentX -- Tool Execution Engine
// ---------------------------------------------------------------------------
//
// Defines, registers, and executes agent tools. Each tool has a typed schema,
// an execute function, and metadata for loop detection. This is the core
// building block that the agentic loop uses to perform actions on behalf of
// the LLM.
//
// Inspired by OpenClaw's pi-tools architecture, adapted for VS Code.
// ---------------------------------------------------------------------------

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * JSON-Schema-like parameter definition for tool inputs.
 */
export interface ToolParameterDef {
  readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  readonly description: string;
  readonly required?: boolean;
  readonly default?: unknown;
  readonly enum?: readonly string[];
}

/**
 * Result returned by every tool execution.
 */
export interface ToolResult {
  readonly content: ReadonlyArray<{ type: 'text'; text: string }>;
  readonly isError: boolean;
  /** Optional structured metadata for downstream consumers. */
  readonly meta?: Record<string, unknown>;
}

/**
 * Tool definition -- everything the engine needs to register and run a tool.
 */
export interface AgentToolDef {
  /** Unique tool name (snake_case by convention). */
  readonly name: string;
  /** Human-readable description shown to the LLM. */
  readonly description: string;
  /** Parameter schema keyed by param name. */
  readonly parameters: Record<string, ToolParameterDef>;
  /**
   * Whether this tool mutates state (files, processes).
   * Loop detection uses this to guard against accidental repeated mutations.
   */
  readonly mutating: boolean;
  /** Execute the tool with validated parameters. */
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * Runtime context passed to every tool execution.
 */
export interface ToolContext {
  readonly workspaceRoot: string;
  readonly abortSignal: AbortSignal;
  readonly log: (message: string) => void;
}

/**
 * A tool call request from the LLM.
 */
export interface ToolCallRequest {
  readonly id: string;
  readonly name: string;
  readonly params: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text }], isError };
}

function isPathInside(parent: string, child: string): boolean {
  const parentNorm = path.resolve(parent);
  const childNorm = path.resolve(child);
  const rel = path.relative(parentNorm, childNorm);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveWorkspaceTarget(workspaceRoot: string, inputPath: string): string | null {
  const target = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workspaceRoot, inputPath);

  if (!isPathInside(workspaceRoot, target)) {
    return null;
  }
  return target;
}

function validateParams(
  tool: AgentToolDef,
  params: Record<string, unknown>,
): string | null {
  for (const [key, def] of Object.entries(tool.parameters)) {
    if (def.required && (params[key] === undefined || params[key] === null)) {
      return `Missing required parameter: ${key}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Built-in tools
// ---------------------------------------------------------------------------

/** Read a file from the workspace. */
export const fileReadTool: AgentToolDef = {
  name: 'file_read',
  description:
    'Read the contents of a file. Returns the full text or a line range.',
  parameters: {
    filePath: {
      type: 'string',
      description: 'Relative path from workspace root.',
      required: true,
    },
    startLine: {
      type: 'number',
      description: 'First line to read (1-based, inclusive). Omit for full file.',
    },
    endLine: {
      type: 'number',
      description: 'Last line to read (1-based, inclusive). Omit for full file.',
    },
  },
  mutating: false,
  async execute(params, ctx) {
    const filePath = params.filePath as string;
    const abs = resolveWorkspaceTarget(ctx.workspaceRoot, filePath);
    if (!abs) {
      return textResult(`Path is outside workspace: ${filePath}`, true);
    }

    if (!fs.existsSync(abs)) {
      return textResult(`File not found: ${filePath}`, true);
    }

    try {
      const raw = fs.readFileSync(abs, 'utf-8');
      const lines = raw.split('\n');
      const start = typeof params.startLine === 'number'
        ? Math.max(0, (params.startLine as number) - 1)
        : 0;
      const end = typeof params.endLine === 'number'
        ? Math.min(lines.length, params.endLine as number)
        : lines.length;

      const slice = lines.slice(start, end);
      const header = `File: ${filePath} (lines ${start + 1}-${end} of ${lines.length})`;
      return textResult(`${header}\n${slice.join('\n')}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResult(`Error reading file: ${msg}`, true);
    }
  },
};

/** Write (create or overwrite) a file. */
export const fileWriteTool: AgentToolDef = {
  name: 'file_write',
  description: 'Create or overwrite a file with the given content.',
  parameters: {
    filePath: {
      type: 'string',
      description: 'Relative path from workspace root.',
      required: true,
    },
    content: {
      type: 'string',
      description: 'Full file content to write.',
      required: true,
    },
  },
  mutating: true,
  async execute(params, ctx) {
    const filePath = params.filePath as string;
    const content = params.content as string;
    const abs = resolveWorkspaceTarget(ctx.workspaceRoot, filePath);
    if (!abs) {
      return textResult(`Path is outside workspace: ${filePath}`, true);
    }

    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf-8');
      return textResult(`File written: ${filePath} (${content.length} chars)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResult(`Error writing file: ${msg}`, true);
    }
  },
};

/** Edit a file by replacing an exact string. */
export const fileEditTool: AgentToolDef = {
  name: 'file_edit',
  description:
    'Replace an exact string in a file. The oldString must match precisely.',
  parameters: {
    filePath: {
      type: 'string',
      description: 'Relative path from workspace root.',
      required: true,
    },
    oldString: {
      type: 'string',
      description: 'Exact text to find and replace.',
      required: true,
    },
    newString: {
      type: 'string',
      description: 'Replacement text.',
      required: true,
    },
  },
  mutating: true,
  async execute(params, ctx) {
    const filePath = params.filePath as string;
    const abs = resolveWorkspaceTarget(ctx.workspaceRoot, filePath);
    if (!abs) {
      return textResult(`Path is outside workspace: ${filePath}`, true);
    }

    if (!fs.existsSync(abs)) {
      return textResult(`File not found: ${filePath}`, true);
    }

    try {
      const raw = fs.readFileSync(abs, 'utf-8');
      const oldStr = params.oldString as string;
      const newStr = params.newString as string;

      const idx = raw.indexOf(oldStr);
      if (idx === -1) {
        return textResult(
          `oldString not found in ${filePath}. Ensure it matches exactly.`,
          true,
        );
      }
      // Check for ambiguity (multiple matches)
      const secondIdx = raw.indexOf(oldStr, idx + 1);
      if (secondIdx !== -1) {
        return textResult(
          `oldString matches multiple locations in ${filePath}. `
          + 'Include more surrounding context to make it unique.',
          true,
        );
      }

      const updated = raw.slice(0, idx) + newStr + raw.slice(idx + oldStr.length);
      fs.writeFileSync(abs, updated, 'utf-8');
      return textResult(`Edited ${filePath}: replaced ${oldStr.length} chars with ${newStr.length} chars.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResult(`Error editing file: ${msg}`, true);
    }
  },
};

/** Execute a terminal command. */
export const terminalExecTool: AgentToolDef = {
  name: 'terminal_exec',
  description:
    'Run a shell command in the workspace directory and return stdout/stderr.',
  parameters: {
    command: {
      type: 'string',
      description: 'Shell command to execute.',
      required: true,
    },
    timeoutMs: {
      type: 'number',
      description: 'Timeout in ms (default 30000).',
      default: 30_000,
    },
  },
  mutating: true,
  async execute(params, ctx) {
    const command = params.command as string;
    const timeoutMs = (params.timeoutMs as number) ?? 30_000;

    // Security: block dangerous commands
    const blocked = ['rm -rf' + ' /', 'format' + ' c:', 'drop' + ' database', 'git reset' + ' --hard'];
    for (const pattern of blocked) {
      if (command.toLowerCase().includes(pattern)) {
        return textResult(`Blocked dangerous command: ${pattern}`, true);
      }
    }

    return new Promise<ToolResult>((resolve) => {
      const child = exec(command, {
        cwd: ctx.workspaceRoot,
        maxBuffer: 1024 * 1024,
        timeout: timeoutMs,
      }, (error, stdout, stderr) => {
        if (ctx.abortSignal.aborted) {
          resolve(textResult('Command aborted.', true));
          return;
        }
        if (error) {
          const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
          resolve(textResult(
            `Command failed (exit ${error.code ?? 'unknown'}):\n${combined || error.message}`,
            true,
          ));
          return;
        }
        const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
        resolve(textResult(output || '(no output)'));
      });

      // Wire abort signal
      ctx.abortSignal.addEventListener('abort', () => {
        child.kill('SIGTERM');
      }, { once: true });
    });
  },
};

/** Search for text patterns in the workspace. */
export const grepSearchTool: AgentToolDef = {
  name: 'grep_search',
  description:
    'Search for a text pattern across workspace files. Returns matching lines.',
  parameters: {
    pattern: {
      type: 'string',
      description: 'Text or regex pattern to search for.',
      required: true,
    },
    includePattern: {
      type: 'string',
      description: 'Glob pattern to filter files (e.g., "**/*.ts").',
    },
    maxResults: {
      type: 'number',
      description: 'Maximum results to return (default 20).',
      default: 20,
    },
  },
  mutating: false,
  async execute(params, ctx) {
    const pattern = params.pattern as string;
    const include = (params.includePattern as string) ?? '**/*';
    const maxResults = (params.maxResults as number) ?? 20;

    try {
      const files = await vscode.workspace.findFiles(include, '**/node_modules/**', 500);
      const results: string[] = [];
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, 'gi');
      } catch {
        regex = new RegExp(escapeRegExp(pattern), 'gi');
      }

      for (const file of files) {
        if (results.length >= maxResults) { break; }
        if (ctx.abortSignal.aborted) { break; }

        try {
          const content = fs.readFileSync(file.fsPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              const relPath = path.relative(ctx.workspaceRoot, file.fsPath);
              results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
              if (results.length >= maxResults) { break; }
            }
            regex.lastIndex = 0; // Reset global regex
          }
        } catch { /* skip unreadable files */ }
      }

      if (results.length === 0) {
        return textResult(`No matches found for pattern: ${pattern}`);
      }
      return textResult(results.join('\n'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResult(`Search error: ${msg}`, true);
    }
  },
};

/** List directory contents. */
export const listDirTool: AgentToolDef = {
  name: 'list_dir',
  description: 'List the contents of a directory in the workspace.',
  parameters: {
    dirPath: {
      type: 'string',
      description: 'Relative path from workspace root (default: root).',
      default: '.',
    },
  },
  mutating: false,
  async execute(params, ctx) {
    const dirPath = (params.dirPath as string) ?? '.';
    const abs = resolveWorkspaceTarget(ctx.workspaceRoot, dirPath);
    if (!abs) {
      return textResult(`Path is outside workspace: ${dirPath}`, true);
    }

    if (!fs.existsSync(abs)) {
      return textResult(`Directory not found: ${dirPath}`, true);
    }

    try {
      const entries = fs.readdirSync(abs, { withFileTypes: true });
      const lines = entries.map((e) =>
        e.isDirectory() ? `${e.name}/` : e.name,
      );
      return textResult(lines.join('\n'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResult(`Error listing directory: ${msg}`, true);
    }
  },
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

/**
 * Central registry for agent tools.
 *
 * Manages registration, lookup, validation, and execution of all tools
 * available to the agentic loop.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, AgentToolDef>();

  constructor() {
    // Register built-in tools
    this.register(fileReadTool);
    this.register(fileWriteTool);
    this.register(fileEditTool);
    this.register(terminalExecTool);
    this.register(grepSearchTool);
    this.register(listDirTool);
  }

  /** Register a tool definition. Overwrites if name already exists. */
  register(tool: AgentToolDef): void {
    this.tools.set(tool.name, tool);
  }

  /** Unregister a tool by name. */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /** Get a tool definition by name. */
  get(name: string): AgentToolDef | undefined {
    return this.tools.get(name);
  }

  /** List all registered tool names. */
  listNames(): string[] {
    return [...this.tools.keys()];
  }

  /** Get tool definitions formatted for LLM function-calling schema. */
  toFunctionSchemas(): ReadonlyArray<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([key, def]) => [
            key,
            {
              type: def.type,
              description: def.description,
              ...(def.enum ? { enum: def.enum } : {}),
              ...(def.default !== undefined ? { default: def.default } : {}),
            },
          ]),
        ),
        required: Object.entries(t.parameters)
          .filter(([, def]) => def.required)
          .map(([key]) => key),
      },
    }));
  }

  /**
   * Execute a tool call with validation.
   *
   * @returns The tool result, or an error result if the tool is unknown
   *          or parameters fail validation.
   */
  async execute(
    call: ToolCallRequest,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return textResult(`Unknown tool: ${call.name}`, true);
    }

    const validationError = validateParams(tool, call.params);
    if (validationError) {
      return textResult(`Parameter validation failed for ${call.name}: ${validationError}`, true);
    }

    if (ctx.abortSignal.aborted) {
      return textResult('Execution aborted.', true);
    }

    try {
      return await tool.execute(call.params, ctx);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResult(`Tool ${call.name} threw an error: ${msg}`, true);
    }
  }
}
