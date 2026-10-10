'use strict';

const path = require('node:path');

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameDirectory = (left, right) => {
  // Windows folding is ASCII-only, matching the workspace identity contract.
  const normalize = value => process.platform === 'win32'
    ? path.resolve(value).replace(/[A-Z]/g, letter => letter.toLowerCase()) : path.resolve(value);
  return normalize(left) === normalize(right);
};

function translateHookInput(event, payload, workspace) {
  if (!isObject(payload)) throw new Error('Cursor hook input must be an object.');
  if (workspace && payload.workspace_roots !== undefined &&
      (!Array.isArray(payload.workspace_roots) ||
       payload.workspace_roots.some(root => typeof root !== 'string' || !path.isAbsolute(root)) ||
       !payload.workspace_roots.some(root => sameDirectory(root, workspace)))) {
    throw new Error('Cursor hook workspace roots do not include the bound Frontier workspace.');
  }
  if (event === 'sessionStart') {
    return {
      hook_event_name: 'SessionStart',
      session_id: payload.session_id ?? payload.conversation_id ?? '',
      ...(typeof payload.source === 'string' ? { source: payload.source } : {}),
    };
  }
  if (event !== 'preToolUse' || typeof payload.tool_name !== 'string' || !isObject(payload.tool_input)) {
    throw new Error('Cursor preToolUse requires a tool name and object tool input.');
  }
  const name = payload.tool_name;
  if (/^Shell$/i.test(name) && workspace) {
    const directory = payload.tool_input.working_directory ?? payload.cwd ?? workspace;
    if (typeof directory !== 'string' || !sameDirectory(path.resolve(workspace, directory), workspace)) {
      throw new Error('Run Cursor shell tools from the initialized workspace root so Frontier can validate relative paths.');
    }
  }
  const readOnly = /^(Read|Grep|Glob|LS|List|ReadFile|Search|WebSearch|WebFetch|AskQuestion|TodoWrite|Task)$/i.test(name);
  const remoteMethod = /^MCP:(?:.*[._:-])?(create_or_update_file|push_files|delete_file)$/i.exec(name);
  const remoteWrite = /github.*(?:create_or_update_file|push_files|delete_file)$/i.test(name);
  const tool = remoteMethod ? `mcp_github_${remoteMethod[1].toLowerCase()}`
    : /^Shell$/i.test(name) ? 'runCommands'
    : readOnly ? 'cursor_read'
      : remoteWrite || /^MCP:/i.test(name) ? name : 'apply_patch';
  const filePaths = [];
  for (const key of ['path', 'file_path', 'filePath', 'target_file', 'targetFile', 'relative_workspace_path']) {
    const value = payload.tool_input[key];
    if (typeof value === 'string') filePaths.push({ path: value });
  }
  for (const key of ['paths', 'files']) {
    const values = payload.tool_input[key];
    if (Array.isArray(values)) {
      for (const value of values) { if (typeof value === 'string') filePaths.push({ path: value }); }
    }
  }
  for (const key of ['patch', 'input']) {
    const patch = payload.tool_input[key];
    if (typeof patch === 'string') {
      for (const match of patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)\r?$/gm)) {
        filePaths.push({ path: match[1].trim() });
      }
    }
  }
  if (/^(Write|Edit|Delete|StrReplace|ApplyPatch|MultiEdit|edit_file|write_file|delete_file)$/i.test(name) && !filePaths.length) {
    throw new Error('Cursor file mutation lacks a recognized path; Frontier cannot validate protected state.');
  }
  return { hook_event_name: 'PreToolUse', tool_name: tool,
    tool_input: { ...payload.tool_input, cursor_paths: filePaths } };
}

function translateHookResult(event, result) {
  if (result.error) throw result.error;
  if (result.status === 2 && event === 'preToolUse') {
    const message = (result.stderr || 'Frontier policy denied this action.').trim().slice(0, 2000);
    return { permission: 'deny', user_message: message, agent_message: message };
  }
  if (result.status !== 0) throw new Error(`Frontier policy hook exited ${result.status}: ${(result.stderr ?? '').trim()}`);
  const response = result.stdout?.trim() ? JSON.parse(result.stdout) : {};
  if (!isObject(response) || (response.continue !== undefined && response.continue !== true)) {
    throw new Error('Invalid Frontier policy response.');
  }
  if (event === 'preToolUse') {
    if (response.systemMessage !== undefined && typeof response.systemMessage !== 'string') {
      throw new Error('Invalid Frontier policy message.');
    }
    return { permission: 'allow', ...(response.systemMessage
      ? { user_message: response.systemMessage, agent_message: response.systemMessage } : {}) };
  }
  const additional = [response.systemMessage, response.hookSpecificOutput?.additionalContext].filter(Boolean);
  if (additional.some(value => typeof value !== 'string')) throw new Error('Invalid repository primer context.');
  return additional.length ? { additional_context: additional.join('\n') } : {};
}

module.exports = { translateHookInput, translateHookResult };