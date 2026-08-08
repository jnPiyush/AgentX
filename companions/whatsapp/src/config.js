const fs = require('fs');
const path = require('path');

const ALLOWED_EVENTS = new Set(['started', 'iteration', 'complete', 'status', 'init']);
const ALLOWED_TOP_LEVEL = new Set([
  'allowedNumbers', 'repoPath', 'cliRelativePath', 'defaultAgent',
  'commandTimeoutMs', 'maxOutputChars', 'maxInputChars', 'maxQueueDepth',
  'confirmationTtlMs', 'capabilities', 'browser', 'whisperModel',
  'whisperLanguage', 'voiceAutoExecuteReadOnly', 'voiceMaxBytes',
  'voiceTimeoutMs', 'logMessageContent', 'notifications',
]);
const DEFAULT_CAPABILITIES = Object.freeze({
  ship: false,
  run: false,
  loopMutation: false,
  raw: false,
});

function normalizeNumber(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} entries must be strings.`);
  const digits = value.replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(digits)) {
    throw new Error(`${label} must contain 8-15 digits including country code.`);
  }
  return digits;
}

function unique(values) {
  return [...new Set(values)];
}

function positiveInteger(value, fallback, label, max) {
  const candidate = value === undefined ? fallback : value;
  if (!Number.isInteger(candidate) || candidate <= 0 || candidate > max) {
    throw new Error(`${label} must be an integer between 1 and ${max}.`);
  }
  return candidate;
}

function assertKnownKeys(value, allowed, label) {
  for (const key of Object.keys(value || {})) {
    if (!allowed.has(key)) throw new Error(`${label}.${key} is not supported.`);
  }
}

function optionalBoolean(value, label) {
  if (value !== undefined && typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
}

function optionalString(value, label, { allowEmpty = false } = {}) {
  if (value !== undefined && (typeof value !== 'string' || (!allowEmpty && !value.trim()))) {
    throw new Error(`${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`);
  }
}

function optionalArray(value, label) {
  if (value !== undefined && !Array.isArray(value)) throw new Error(`${label} must be an array.`);
}

function readConfigFile(configPath) {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`config.json is invalid: ${error.message}`);
  }
}

function loadConfig({ env = process.env, configPath } = {}) {
  const root = path.resolve(__dirname, '..');
  const resolvedConfigPath = configPath || path.join(root, 'config.json');
  const fileConfig = readConfigFile(resolvedConfigPath);
  if (!fileConfig || typeof fileConfig !== 'object' || Array.isArray(fileConfig)) {
    throw new Error('config.json must contain a JSON object.');
  }
  if (Object.prototype.hasOwnProperty.call(fileConfig, 'openaiApiKey')) {
    throw new Error('Do not store openaiApiKey in config.json; use OPENAI_API_KEY.');
  }
  assertKnownKeys(fileConfig, ALLOWED_TOP_LEVEL, 'config');

  optionalArray(fileConfig.allowedNumbers, 'allowedNumbers');
  optionalString(fileConfig.repoPath, 'repoPath');
  optionalString(fileConfig.cliRelativePath, 'cliRelativePath');
  optionalString(fileConfig.defaultAgent, 'defaultAgent');
  optionalString(fileConfig.whisperModel, 'whisperModel');
  optionalString(fileConfig.whisperLanguage, 'whisperLanguage', { allowEmpty: true });
  optionalBoolean(fileConfig.voiceAutoExecuteReadOnly, 'voiceAutoExecuteReadOnly');
  optionalBoolean(fileConfig.logMessageContent, 'logMessageContent');

  const envAllowed = String(env.AGENTX_WA_ALLOWED || '').split(',').map((value) => value.trim()).filter(Boolean);
  const allowedNumbers = unique((envAllowed.length ? envAllowed : fileConfig.allowedNumbers || [])
    .map((value) => normalizeNumber(value, 'allowedNumbers')));
  if (!allowedNumbers.length) throw new Error('At least one allowedNumbers entry is required.');

  for (const key of ['browser', 'notifications', 'capabilities']) {
    const value = fileConfig[key];
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) {
      throw new Error(`${key} must be a JSON object.`);
    }
  }
  const browserConfig = fileConfig.browser || {};
  const notificationsConfig = fileConfig.notifications || {};
  const configuredCapabilities = fileConfig.capabilities || {};
  assertKnownKeys(browserConfig, new Set(['headless', 'executablePath']), 'browser');
  assertKnownKeys(notificationsConfig, new Set(['enabled', 'targets', 'events', 'debounceMs', 'pollMs']), 'notifications');
  assertKnownKeys(configuredCapabilities, new Set(Object.keys(DEFAULT_CAPABILITIES)), 'capabilities');
  optionalBoolean(browserConfig.headless, 'browser.headless');
  optionalString(browserConfig.executablePath, 'browser.executablePath');
  optionalBoolean(notificationsConfig.enabled, 'notifications.enabled');
  optionalArray(notificationsConfig.targets, 'notifications.targets');
  optionalArray(notificationsConfig.events, 'notifications.events');

  const repoPath = path.resolve(env.AGENTX_REPO || fileConfig.repoPath || path.resolve(root, '..', '..'));
  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
    throw new Error(`repoPath does not exist or is not a directory: ${repoPath}`);
  }

  const cliRelativePath = fileConfig.cliRelativePath || '.agentx/agentx.ps1';
  if (path.isAbsolute(cliRelativePath) || cliRelativePath.split(/[\\/]/).includes('..')) {
    throw new Error('cliRelativePath must be repository-relative without parent traversal.');
  }
  const cliPath = path.resolve(repoPath, cliRelativePath);
  if (!cliPath.startsWith(`${repoPath}${path.sep}`) || !fs.existsSync(cliPath)) {
    throw new Error(`AgentX CLI not found inside repoPath: ${cliPath}`);
  }

  const notificationTargets = unique((notificationsConfig.targets || allowedNumbers)
    .map((value) => normalizeNumber(value, 'notifications.targets')));
  if (notificationTargets.some((target) => !allowedNumbers.includes(target))) {
    throw new Error('notifications.targets must be a subset of allowedNumbers.');
  }
  const notificationEvents = unique(notificationsConfig.events || ['started', 'iteration', 'complete', 'status']);
  if (notificationEvents.some((event) => !ALLOWED_EVENTS.has(event))) {
    throw new Error(`notifications.events may contain only: ${[...ALLOWED_EVENTS].join(', ')}.`);
  }
  for (const [name, value] of Object.entries(configuredCapabilities)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CAPABILITIES, name) || typeof value !== 'boolean') {
      throw new Error(`capabilities.${name} must be a known boolean capability.`);
    }
  }
  const browserExecutable = browserConfig.executablePath
    ? path.resolve(browserConfig.executablePath)
    : undefined;
  if (browserExecutable && !fs.existsSync(browserExecutable)) {
    throw new Error(`browser.executablePath does not exist: ${browserExecutable}`);
  }

  return {
    allowedNumbers,
    repoPath,
    cliRelativePath,
    defaultAgent: fileConfig.defaultAgent || 'engineer',
    commandTimeoutMs: positiveInteger(fileConfig.commandTimeoutMs, 600000, 'commandTimeoutMs', 3600000),
    maxOutputChars: positiveInteger(fileConfig.maxOutputChars, 6000, 'maxOutputChars', 50000),
    maxInputChars: positiveInteger(fileConfig.maxInputChars, 2000, 'maxInputChars', 10000),
    maxQueueDepth: positiveInteger(fileConfig.maxQueueDepth, 5, 'maxQueueDepth', 50),
    confirmationTtlMs: positiveInteger(fileConfig.confirmationTtlMs, 120000, 'confirmationTtlMs', 600000),
    capabilities: { ...DEFAULT_CAPABILITIES, ...configuredCapabilities },
    browser: {
      headless: browserConfig.headless !== false,
      executablePath: browserExecutable,
    },
    openaiApiKey: env.OPENAI_API_KEY || '',
    whisperModel: fileConfig.whisperModel || 'whisper-1',
    whisperLanguage: fileConfig.whisperLanguage || '',
    voiceAutoExecuteReadOnly: fileConfig.voiceAutoExecuteReadOnly === true,
    voiceMaxBytes: positiveInteger(fileConfig.voiceMaxBytes, 10485760, 'voiceMaxBytes', 26214400),
    voiceTimeoutMs: positiveInteger(fileConfig.voiceTimeoutMs, 60000, 'voiceTimeoutMs', 300000),
    logMessageContent: fileConfig.logMessageContent === true,
    notifications: {
      enabled: notificationsConfig.enabled !== false,
      targets: notificationTargets,
      events: notificationEvents,
      debounceMs: positiveInteger(notificationsConfig.debounceMs, 750, 'notifications.debounceMs', 10000),
      pollMs: positiveInteger(notificationsConfig.pollMs, 5000, 'notifications.pollMs', 60000),
    },
  };
}

module.exports = { DEFAULT_CAPABILITIES, loadConfig, normalizeNumber };
