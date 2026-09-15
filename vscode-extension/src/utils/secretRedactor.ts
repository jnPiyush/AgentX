// ---------------------------------------------------------------------------
// Frontier -- Secret Redactor
// ---------------------------------------------------------------------------
//
// Strips known credential patterns from strings to prevent credential leaks
// in log output, tool results, and thinking log entries.
//
// All regexes are pre-compiled at module load for performance.
// The redactSecrets() function is idempotent: applying it twice produces
// the same output as applying it once.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Compiled patterns
// ---------------------------------------------------------------------------

type ReplacementValue = string | ((substring: string, ...args: unknown[]) => string);

interface RedactionRule {
  readonly pattern: RegExp;
  readonly replacement: ReplacementValue;
}

/**
 * Ordered list of redaction rules.  More specific patterns are listed first
 * so they take precedence over the generic credential sweep at the end.
 */
const RULES: readonly RedactionRule[] = [
  // Bearer tokens in Authorization headers (require at least 8 chars to
  // avoid false positives like "Bearer of bad news")
  {
    pattern: /Bearer\s+[A-Za-z0-9\-._~+/]{8,}=*/gi,
    replacement: 'Bearer [REDACTED:bearer]',
  },
  // JWT tokens (three base64url segments)
  {
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replacement: '[REDACTED:jwt]',
  },
  // OpenAI / Anthropic-style API keys
  {
    pattern: /sk-[A-Za-z0-9]{20,}/g,
    replacement: '[REDACTED:api-key]',
  },
  // GitHub fine-grained PATs
  {
    pattern: /github_pat_[A-Za-z0-9_]{22,}/g,
    replacement: '[REDACTED:github-pat]',
  },
  // GitHub OAuth / server-to-server tokens
  {
    pattern: /gh[ps]_[A-Za-z0-9]{36,}/g,
    replacement: '[REDACTED:github-token]',
  },
  // AWS access key IDs
  {
    pattern: /AKIA[A-Z0-9]{16}/g,
    replacement: '[REDACTED:aws-key]',
  },
  // Azure Storage account keys (AccountKey=... in connection strings)
  {
    pattern: /AccountKey=[A-Za-z0-9+/=]{20,}/gi,
    replacement: 'AccountKey=[REDACTED:azure-key]',
  },
  // Azure SAS tokens in URLs or connection strings
  {
    pattern: /([?&]sv=[^&\s"']+&[^\s"']*sig=)[A-Za-z0-9%+/=:-]{16,}/gi,
    replacement: '$1[REDACTED:azure-sas]',
  },
  // GCP service account private key blocks inside JSON blobs
  {
    pattern: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----\\n?"/g,
    replacement: '"private_key":"[REDACTED:gcp-private-key]"',
  },
  // Generic password / secret / token / api_key assignments
  // Matches: password=foo, secret:"bar", "token": "baz123", TOKEN = 'qux' etc.
  // The optional ["']? before [=:] handles JSON-style "key": "value" patterns.
  // Requires at least 8 non-whitespace chars after the separator to reduce
  // false positives on short values like "token=none".
  // Negative lookahead prevents re-redacting already-redacted placeholder values.
  {
    pattern: /(?:password|secret|token|api[_-]?key)["']?\s*[=:]\s*["']?(?!\[REDACTED:)[^\s"',]{8,}/gi,
    replacement: (match: string) => {
      // Preserve the key name and separator, redact only the value portion.
      const eqIdx = match.search(/[=:]/);
      const prefix = match.slice(0, eqIdx + 1);
      return `${prefix}[REDACTED:credential]`;
    },
  },
];

// ---------------------------------------------------------------------------
// Detection fast-path
// ---------------------------------------------------------------------------

/**
 * Quick-check pattern that tests whether any redaction is necessary.
 * This avoids running all 8 replacement regexes on clean strings.
 */
const QUICK_CHECK_PATTERN =
  /Bearer\s|eyJ[A-Za-z0-9_-]{10,}\.|sk-[A-Za-z0-9]{20}|github_pat_|gh[ps]_|AKIA[A-Z0-9]{16}|AccountKey=|[?&]sv=|"private_key"\s*:|(?:password|secret|token|api[_-]?key)["']?\s*[=:]/i;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the input string contains at least one pattern that
 * redactSecrets() would replace.  Use this as a fast pre-check to avoid
 * unnecessary work on clean strings.
 */
export function isRedactionNeeded(input: string): boolean {
  return QUICK_CHECK_PATTERN.test(input);
}

/**
 * Replaces all known credential patterns in `input` with safe placeholders.
 *
 * Properties:
 * - Idempotent: redactSecrets(redactSecrets(s)) === redactSecrets(s)
 * - Non-mutating: returns a new string, never modifies the argument
 * - Fast: all regexes are pre-compiled at module load
 *
 * @param input Any string -- typically log lines, tool output, or user text.
 * @returns The sanitised string with credentials replaced by [REDACTED:...] tokens.
 */
export function redactSecrets(input: string): string {
  if (!input || !isRedactionNeeded(input)) {
    return input;
  }

  let result = input;

  for (const rule of RULES) {
    // Reset lastIndex because we reuse compiled regexes across calls.
    rule.pattern.lastIndex = 0;
    // TypeScript overloads for String.replace accept both string and function.
    // We cast to `any` here only to bridge the overload union -- the runtime
    // behaviour is correct in both branches.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = result.replace(rule.pattern, rule.replacement as any);
    // Reset again after the replacement so the next call starts fresh.
    rule.pattern.lastIndex = 0;
  }

  return result;
}
