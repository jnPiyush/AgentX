// ---------------------------------------------------------------------------
// AgentX -- Tool Execution Engine
// ---------------------------------------------------------------------------
//
// Defines, registers, and executes agent tools. Each tool has a typed schema,
// an execute function, and metadata for loop detection. This is the core
// building block that the agentic loop uses to perform actions on behalf of
// the LLM.
//
// ---------------------------------------------------------------------------

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { validateCommand } from '../utils/commandValidator';
import { redactSecrets } from '../utils/secretRedactor';
import { validatePath } from '../utils/pathSandbox';
import { validateToolUrlParams } from '../utils/ssrfValidator';
import { analyzeCo, findDependencies, mapArchitecture } from './codebaseAnalysis';

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
    const pathCheck = validatePath(filePath, ctx.workspaceRoot);
    if (!pathCheck.allowed) {
      return textResult(`Path access denied: ${pathCheck.reason ?? filePath}`, true);
    }
    const abs = pathCheck.resolvedPath;

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
    const pathCheck = validatePath(filePath, ctx.workspaceRoot);
    if (!pathCheck.allowed) {
      return textResult(`Path access denied: ${pathCheck.reason ?? filePath}`, true);
    }
    const abs = pathCheck.resolvedPath;

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
    const pathCheck = validatePath(filePath, ctx.workspaceRoot);
    if (!pathCheck.allowed) {
      return textResult(`Path access denied: ${pathCheck.reason ?? filePath}`, true);
    }
    const abs = pathCheck.resolvedPath;

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

    // Security: validate command against allowlist / blocklist
    const validation = validateCommand(command);

    if (validation.classification === 'blocked') {
      return textResult(
        `Blocked dangerous command: ${validation.reason ?? command}`,
        true,
      );
    }

    if (validation.classification === 'requires_confirmation') {
      // Return a special result so the agentic loop can request user confirmation.
      // The caller inspects meta.requiresConfirmation to pause execution.
      // Redact secrets from command text to prevent credential leakage in
      // UI, logs, or telemetry pipelines.
      const safeCommand = redactSecrets(command);
      return {
        content: [{
          type: 'text',
          text:
            `Command requires user confirmation before execution.\n` +
            `Command: ${safeCommand}\n` +
            `Reversibility: ${validation.reversibility ?? 'unknown'}\n` +
            (validation.undoHint ? `Undo hint: ${validation.undoHint}\n` : '') +
            `Reason: ${validation.reason ?? ''}`,
        }],
        isError: false,
        meta: {
          requiresConfirmation: true,
          command: safeCommand,
          reversibility: validation.reversibility,
          undoHint: validation.undoHint,
        },
      };
    }

    // classification === 'allowed' -- proceed with execution
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
          const combined = [stdout.trim(), stderr.trim()]
            .filter(Boolean)
            .map(redactSecrets)
            .join('\n');
          resolve(textResult(
            `Command failed (exit ${error.code ?? 'unknown'}):\n${combined || redactSecrets(error.message)}`,
            true,
          ));
          return;
        }
        const output = [stdout.trim(), stderr.trim()]
          .filter(Boolean)
          .map(redactSecrets)
          .join('\n');
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
// Tool Category Resolution
// ---------------------------------------------------------------------------

/**
 * Mapping from abstract agent frontmatter tool categories to concrete
 * built-in tool names. Categories are the values used in .agent.md
 * frontmatter `tools:` arrays.
 *
 * External tools (e.g., 'github/*', 'ms-azuretools...') are passed
 * through as-is since they are VS Code extension tools, not managed
 * by this registry.
 */
const TOOL_CATEGORY_MAP: ReadonlyMap<string, readonly string[]> = new Map([
  ['read', ['file_read', 'list_dir']],
  ['edit', ['file_write', 'file_edit']],
  ['execute', ['terminal_exec']],
  ['search', ['grep_search', 'file_read', 'list_dir']],
  ['agent', ['request_clarification']],
  ['vscode', ['file_read', 'file_write', 'file_edit', 'list_dir', 'grep_search']],
  ['web', []], // External capability, not a built-in tool
  ['todo', ['validate_done']],
  ['validate', ['validate_done']],
]);

/**
 * Resolve abstract tool categories to concrete tool names.
 *
 * @param categories - Array of category names from agent frontmatter
 * @returns Set of concrete tool names the agent can use
 */
export function resolveToolCategories(
  categories: readonly string[],
): Set<string> {
  const resolved = new Set<string>();
  for (const cat of categories) {
    const mapped = TOOL_CATEGORY_MAP.get(cat.toLowerCase().trim());
    if (mapped) {
      for (const toolName of mapped) {
        resolved.add(toolName);
      }
    }
    // If the category exactly matches a built-in tool name, add it directly
    if (cat.includes('_') || cat.startsWith('file_') || cat.startsWith('terminal_')
        || cat.startsWith('grep_') || cat.startsWith('list_')) {
      resolved.add(cat);
    }
    // External tool references (e.g. 'github/*') are not in the registry
    // but we add them so the filter doesn't accidentally exclude them
    // if someone uses them as direct names.
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Agent Communication Tools
// ---------------------------------------------------------------------------

/**
 * Callback type for handling clarification requests from within a tool.
 * Set on the ToolRegistry so the request_clarification tool can invoke it.
 */
export type ClarificationHandler = (
  targetAgent: string,
  topic: string,
  question: string,
) => Promise<{ answer: string }>;

/** Request clarification from another agent (agent-to-agent communication). */
export const requestClarificationTool: AgentToolDef = {
  name: 'request_clarification',
  description:
    'Request clarification from another agent when you are blocked and need '
    + 'information only that agent can provide. The response will contain the '
    + 'target agent\'s answer. Only use when truly blocked -- for minor '
    + 'decisions, use your best judgment instead.',
  parameters: {
    targetAgent: {
      type: 'string',
      description: 'Name of the agent to ask (e.g. architect, product-manager, engineer).',
      required: true,
    },
    topic: {
      type: 'string',
      description: 'Short topic label for the clarification (e.g. "authentication flow").',
      required: true,
    },
    question: {
      type: 'string',
      description: 'The full question to ask the target agent. Be specific and provide context.',
      required: true,
    },
  },
  mutating: false,
  async execute(params, ctx) {
    const targetAgent = params.targetAgent as string;
    const topic = params.topic as string;
    const question = params.question as string;

    // The handler is injected by the ToolRegistry owner (AgenticLoop / ChatHandler)
    const handler = (ctx as ToolContext & { clarificationHandler?: ClarificationHandler })
      .clarificationHandler;

    if (!handler) {
      return textResult(
        'Clarification is not available in this context. '
        + 'Make your best judgment and proceed.',
        false,
      );
    }

    try {
      const result = await handler(targetAgent, topic, question);
      return textResult(
        `[Clarification from ${targetAgent}]:\n\n${result.answer}`,
        false,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResult(
        `Clarification request to ${targetAgent} failed: ${msg}. `
        + 'Proceed with your best judgment.',
        true,
      );
    }
  },
};

// ---------------------------------------------------------------------------
// Done-Validation Tool
// ---------------------------------------------------------------------------

/** Validate whether the current task meets completion criteria. */
export const validateDoneTool: AgentToolDef = {
  name: 'validate_done',
  description:
    'Run completion validation checks before finishing. Checks: tests pass, '
    + 'lint clean, coverage met, and custom criteria. Call this before '
    + 'providing your final response to ensure quality gates are satisfied.',
  parameters: {
    criteria: {
      type: 'string',
      description:
        'Comma-separated validation checks to run. Options: tests, lint, '
        + 'coverage, build, custom. Default: "tests,lint".',
      default: 'tests,lint',
    },
    customCommand: {
      type: 'string',
      description: 'Custom shell command to run for validation (used with "custom" criteria).',
    },
  },
  mutating: false,
  async execute(params, ctx) {
    const criteria = ((params.criteria as string) ?? 'tests,lint')
      .split(',')
      .map(c => c.trim().toLowerCase());

    const results: string[] = [];
    let allPassed = true;

    for (const check of criteria) {
      switch (check) {
        case 'tests': {
          // Detect test framework and run tests
          const testResult = await runValidationCommand(ctx, [
            'npx jest --passWithNoTests --ci 2>&1',
            'npm test 2>&1',
            'dotnet test --no-build 2>&1',
            'python -m pytest --tb=short 2>&1',
          ]);
          if (testResult.passed) {
            results.push('[PASS] Tests: All tests passing');
          } else {
            results.push(`[FAIL] Tests: ${testResult.output.slice(0, 300)}`);
            allPassed = false;
          }
          break;
        }
        case 'lint': {
          const lintResult = await runValidationCommand(ctx, [
            'npx eslint . --max-warnings=0 2>&1',
            'npm run lint 2>&1',
            'dotnet format --verify-no-changes 2>&1',
            'python -m flake8 . 2>&1',
          ]);
          if (lintResult.passed) {
            results.push('[PASS] Lint: No warnings or errors');
          } else {
            results.push(`[FAIL] Lint: ${lintResult.output.slice(0, 300)}`);
            allPassed = false;
          }
          break;
        }
        case 'build': {
          const buildResult = await runValidationCommand(ctx, [
            'npm run build 2>&1',
            'npx tsc --noEmit 2>&1',
            'dotnet build --no-restore 2>&1',
          ]);
          if (buildResult.passed) {
            results.push('[PASS] Build: Compiles successfully');
          } else {
            results.push(`[FAIL] Build: ${buildResult.output.slice(0, 300)}`);
            allPassed = false;
          }
          break;
        }
        case 'coverage': {
          const covResult = await runValidationCommand(ctx, [
            'npx jest --coverage --ci 2>&1',
          ]);
          if (covResult.passed) {
            // Parse coverage percentage if possible
            const covMatch = covResult.output.match(/All files\s*\|\s*([\d.]+)/);
            const pct = covMatch ? covMatch[1] : 'unknown';
            results.push(`[PASS] Coverage: ${pct}%`);
          } else {
            results.push(`[FAIL] Coverage: ${covResult.output.slice(0, 300)}`);
            allPassed = false;
          }
          break;
        }
        case 'custom': {
          const cmd = params.customCommand as string;
          if (!cmd) {
            results.push('[SKIP] Custom: No command provided');
          } else {
            const customResult = await runShellCommand(ctx, cmd);
            if (customResult.passed) {
              results.push(`[PASS] Custom: ${cmd}`);
            } else {
              results.push(`[FAIL] Custom (${cmd}): ${customResult.output.slice(0, 300)}`);
              allPassed = false;
            }
          }
          break;
        }
        default:
          results.push(`[SKIP] Unknown criteria: ${check}`);
      }
    }

    const summary = allPassed
      ? 'VALIDATION PASSED -- All checks green. Safe to finalize.'
      : 'VALIDATION FAILED -- Fix the failing checks and re-validate before finalizing.';

    return textResult(`${summary}\n\n${results.join('\n')}`);
  },
};

/**
 * Try multiple validation commands until one succeeds or all fail.
 * Returns the result of the first command that exits with code 0,
 * or the last failure if none succeed.
 */
async function runValidationCommand(
  ctx: ToolContext,
  commands: string[],
): Promise<{ passed: boolean; output: string }> {
  for (const cmd of commands) {
    const result = await runShellCommand(ctx, cmd);
    // If exit code 0, this check passed
    if (result.passed) {
      return result;
    }
    // If the command was found but failed (not "command not found"), report it
    if (!result.output.includes('not found') && !result.output.includes('not recognized')) {
      return result;
    }
    // Otherwise try the next command
  }
  return { passed: false, output: 'No supported validation tool found in workspace.' };
}

function runShellCommand(
  ctx: ToolContext,
  command: string,
): Promise<{ passed: boolean; output: string }> {
  return new Promise((resolve) => {
    exec(command, { cwd: ctx.workspaceRoot, timeout: 60_000 }, (err, stdout, stderr) => {
      if (ctx.abortSignal.aborted) {
        resolve({ passed: false, output: 'Aborted' });
        return;
      }
      const output = (stdout + '\n' + stderr).trim();
      resolve({ passed: !err, output: output.slice(0, 2000) });
    });
  });
}

// ---------------------------------------------------------------------------
// Codebase Analysis Tools
// ---------------------------------------------------------------------------

/** Analyze workspace structure, file counts, LOC, and detected technologies. */
export const analyzeCodebaseTool: AgentToolDef = {
  name: 'analyze_codebase',
  description:
    'Analyze the workspace for file counts, lines of code, directory tree, '
    + 'and detected technologies (languages, frameworks).',
  parameters: {
    maxDepth: {
      type: 'number',
      description: 'Maximum directory depth for the tree view (default 4).',
      default: 4,
    },
  },
  mutating: false,
  async execute(params, ctx) {
    const maxDepth = (params.maxDepth as number) ?? 4;
    const stats = analyzeCo(ctx.workspaceRoot, maxDepth);
    const lines = [
      `Total files: ${stats.totalFiles}`,
      `Total directories: ${stats.totalDirectories}`,
      `Total lines: ${stats.totalLines}`,
      `Technologies: ${stats.technologies.join(', ') || '(none detected)'}`,
      '',
      'Files by extension:',
      ...Object.entries(stats.filesByExtension)
        .sort(([, a], [, b]) => b - a)
        .map(([ext, count]) => `  ${ext}: ${count}`),
      '',
      'Directory tree:',
      stats.tree,
    ];
    return textResult(lines.join('\n'));
  },
};

/** Detect package managers and parse dependency files. */
export const findDependenciesTool: AgentToolDef = {
  name: 'find_dependencies',
  description:
    'Detect package managers and parse dependency files in the workspace '
    + '(package.json, requirements.txt, *.csproj, go.mod, Cargo.toml, etc.).',
  parameters: {},
  mutating: false,
  async execute(_params, ctx) {
    const deps = findDependencies(ctx.workspaceRoot);
    if (deps.length === 0) {
      return textResult('No dependency files detected in the workspace.');
    }
    const sections = deps.map((d) => {
      const depCount = Object.keys(d.dependencies).length;
      const devCount = Object.keys(d.devDependencies).length;
      const lines = [`[${d.manager}] ${d.file} (${depCount} deps, ${devCount} dev)`];
      if (depCount > 0) {
        lines.push('  Dependencies:');
        for (const [name, version] of Object.entries(d.dependencies)) {
          lines.push(`    ${name}: ${version}`);
        }
      }
      if (devCount > 0) {
        lines.push('  Dev Dependencies:');
        for (const [name, version] of Object.entries(d.devDependencies)) {
          lines.push(`    ${name}: ${version}`);
        }
      }
      return lines.join('\n');
    });
    return textResult(sections.join('\n\n'));
  },
};

/** Map workspace architecture: entry points, configs, tests, CI, docs. */
export const mapArchitectureTool: AgentToolDef = {
  name: 'map_architecture',
  description:
    'Map the architecture of the workspace by identifying entry points, '
    + 'config files, test directories, CI pipelines, documentation, '
    + 'build outputs, and scripts.',
  parameters: {},
  mutating: false,
  async execute(_params, ctx) {
    const arch = mapArchitecture(ctx.workspaceRoot);
    const sections = [
      `Entry points: ${arch.entryPoints.join(', ') || '(none)'}`,
      `Config files: ${arch.configFiles.join(', ') || '(none)'}`,
      `Test directories: ${arch.testDirectories.join(', ') || '(none)'}`,
      `CI files: ${arch.ciFiles.join(', ') || '(none)'}`,
      `Documentation: ${arch.docFiles.join(', ') || '(none)'}`,
      `Build outputs: ${arch.buildOutputs.join(', ') || '(none)'}`,
      `Scripts: ${arch.scripts.join(', ') || '(none)'}`,
    ];
    return textResult(sections.join('\n'));
  },
};

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
    this.register(requestClarificationTool);
    this.register(validateDoneTool);
    // Codebase analysis tools
    this.register(analyzeCodebaseTool);
    this.register(findDependenciesTool);
    this.register(mapArchitectureTool);
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
   * Get tool schemas filtered by agent's declared tool categories.
   *
   * Agent definitions use abstract category names (e.g., 'read', 'edit',
   * 'execute', 'search', 'agent') which map to concrete tool names.
   * If `allowedTools` is empty or undefined, all tools are returned
   * (backward-compatible default).
   *
   * @param allowedTools - Tool category names from agent definition
   * @returns Filtered tool schemas for the LLM
   */
  toFilteredFunctionSchemas(
    allowedTools?: readonly string[],
  ): ReadonlyArray<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    if (!allowedTools || allowedTools.length === 0) {
      return this.toFunctionSchemas();
    }

    const resolvedNames = resolveToolCategories(allowedTools);
    return this.toFunctionSchemas().filter(
      (schema) => resolvedNames.has(schema.name),
    );
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

    // SSRF protection: validate any URL-valued parameters before execution
    const ssrfCheck = validateToolUrlParams(call.params);
    if (!ssrfCheck.allowed) {
      return textResult(`SSRF validation blocked ${call.name}: ${ssrfCheck.reason ?? 'Blocked by SSRF policy'}`, true);
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
