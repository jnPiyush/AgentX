// ---------------------------------------------------------------------------
// AgentX -- SSRF Validator
// ---------------------------------------------------------------------------
//
// Validates outbound HTTP/HTTPS URLs to prevent Server-Side Request Forgery
// (SSRF) attacks. Blocks private IP ranges, cloud metadata endpoints, and
// non-HTTP schemes before any outbound request is made.
//
// Usage pattern mirrors pathSandbox.ts: pure functions, pre-compiled regexes,
// readonly data, no external npm dependencies (Node.js builtins only).
//
// Integration: call validateUrl() or resolveAndValidate() in toolEngine.ts
// before executing any tool that takes a URL parameter.
// ---------------------------------------------------------------------------

import * as dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of an SSRF validation check.
 */
export interface SsrfValidationResult {
  /** Whether the URL is permitted for outbound requests. */
  readonly allowed: boolean;
  /** The original (or normalized) URL that was checked. */
  readonly url: string;
  /** Human-readable reason when allowed=false. */
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Blocked scheme list (pre-compiled for performance)
// ---------------------------------------------------------------------------

/**
 * URL schemes that are never permitted for outbound HTTP tool calls.
 * Only http: and https: are allowed.
 */
const ALLOWED_SCHEMES: readonly string[] = ['http:', 'https:'];

// ---------------------------------------------------------------------------
// Blocked cloud metadata endpoints (exact hostnames)
// ---------------------------------------------------------------------------

/**
 * Cloud metadata service endpoints that must never be reachable.
 * AWS IMDSv1/v2, GCE metadata, Alibaba Cloud metadata.
 */
const BLOCKED_METADATA_HOSTS: ReadonlySet<string> = new Set([
  '169.254.169.254',         // AWS / Azure / GCP instance metadata
  'metadata.google.internal', // GCE metadata domain
  '100.100.100.200',          // Alibaba Cloud metadata
  'fd00:ec2::254',            // AWS IPv6 metadata
]);

// ---------------------------------------------------------------------------
// Private / link-local IP detection (pre-compiled regexes)
// ---------------------------------------------------------------------------

/**
 * IPv4 private range patterns.
 *
 * Covered ranges:
 *   10.0.0.0/8       - Class A private
 *   172.16.0.0/12    - Class B private (172.16.x.x - 172.31.x.x)
 *   192.168.0.0/16   - Class C private
 *   127.0.0.0/8      - Loopback
 *   169.254.0.0/16   - Link-local / AWS metadata reachable via this range
 *   0.0.0.0/8        - "This" network
 */
const PRIVATE_IPV4_PATTERNS: readonly RegExp[] = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
];

/**
 * IPv6 private/loopback range patterns.
 *
 * Covered ranges:
 *   ::1              - Loopback
 *   fc00::/7         - Unique-local (fc00:: and fd00::)
 *   fe80::/10        - Link-local
 *   ::ffff:0:0/96    - IPv4-mapped IPv6 (needs further IPv4 check)
 */
const PRIVATE_IPV6_PATTERNS: readonly RegExp[] = [
  /^::1$/i,
  /^f[cd][0-9a-f]{2}:/i,     // fc00::/7 (fc and fd prefixes)
  /^fe[89ab][0-9a-f]:/i,     // fe80::/10 link-local
];

// ---------------------------------------------------------------------------
// Configurable allow-list (for corporate proxies / internal trusted hosts)
// ---------------------------------------------------------------------------

/**
 * Mutable allow-list for internal URLs that should bypass SSRF checks.
 * Use addAllowedHost() to register trusted hosts at startup.
 * Example: corporate proxy, internal registry, trusted CI endpoints.
 */
const INTERNAL_ALLOWLIST: Set<string> = new Set();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a hostname to the SSRF allow-list.
 * Use this to permit corporate proxies or known-safe internal endpoints.
 *
 * @param hostname - Exact hostname to allow (e.g. 'proxy.corp.example.com')
 */
export function addAllowedHost(hostname: string): void {
  INTERNAL_ALLOWLIST.add(hostname.toLowerCase());
}

/**
 * Remove a hostname from the SSRF allow-list.
 *
 * @param hostname - Hostname to remove
 * @returns true if the hostname was present and removed, false otherwise
 */
export function removeAllowedHost(hostname: string): boolean {
  return INTERNAL_ALLOWLIST.delete(hostname.toLowerCase());
}

/**
 * Return a snapshot of the current allow-list (for diagnostics).
 */
export function getAllowedHosts(): ReadonlySet<string> {
  return new Set(INTERNAL_ALLOWLIST);
}

/**
 * Check whether a given IP address string falls within a private/
 * link-local range.
 *
 * Handles both IPv4 and IPv6 addresses. IPv4-mapped IPv6 addresses
 * (::ffff:1.2.3.4) are unwrapped and checked as IPv4.
 *
 * @param ip - IP address string (dotted-decimal or colon-separated)
 * @returns true if the IP is private/loopback/link-local
 * @pure
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip) { return false; }

  const normalized = ip.trim();

  // Unwrap IPv4-mapped IPv6 (::ffff:1.2.3.4 or ::ffff:0102:0304)
  const ipv4Mapped = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (ipv4Mapped) {
    return isPrivateIp(ipv4Mapped[1]);
  }

  // IPv4 check
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return PRIVATE_IPV4_PATTERNS.some((re) => re.test(normalized));
  }

  // IPv6 check
  return PRIVATE_IPV6_PATTERNS.some((re) => re.test(normalized));
}

/**
 * Validate a URL against SSRF attack vectors using only static analysis
 * (no DNS resolution). Suitable for synchronous fast-path rejection.
 *
 * Checks performed:
 *   1. URL parseable by the WHATWG URL parser
 *   2. Scheme must be http: or https:
 *   3. Hostname not in blocked metadata host list
 *   4. Hostname not resolving to private IP directly (literal IP check)
 *   5. Hostname not in allow-list bypass (allow-list permits skipping checks 3-4)
 *
 * @param rawUrl - URL string to validate
 * @returns SsrfValidationResult
 * @pure (modulo INTERNAL_ALLOWLIST)
 */
export function validateUrl(rawUrl: string): SsrfValidationResult {
  if (!rawUrl || rawUrl.trim() === '') {
    return { allowed: false, url: rawUrl, reason: 'Empty URL' };
  }

  // Step 1: Parse URL
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, url: rawUrl, reason: 'Invalid URL: could not be parsed' };
  }

  const url = parsed.toString();
  const hostname = parsed.hostname.toLowerCase();

  // Step 2: Check scheme
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return {
      allowed: false,
      url,
      reason: `Scheme "${parsed.protocol}" is not allowed; only http: and https: are permitted`,
    };
  }

  // Step 3: Allow-list bypass
  if (INTERNAL_ALLOWLIST.has(hostname)) {
    return { allowed: true, url };
  }

  // Step 4: Blocked metadata hostnames
  if (BLOCKED_METADATA_HOSTS.has(hostname)) {
    return {
      allowed: false,
      url,
      reason: `Hostname "${hostname}" is a blocked cloud metadata endpoint`,
    };
  }

  // Step 5: Literal private IP in hostname (e.g. http://192.168.1.1/path)
  if (isPrivateIp(hostname)) {
    return {
      allowed: false,
      url,
      reason: `Hostname "${hostname}" resolves to a private/loopback IP address`,
    };
  }

  return { allowed: true, url };
}

/**
 * Validate a URL and additionally perform DNS resolution to catch DNS
 * rebinding attacks where a public hostname resolves to a private IP.
 *
 * This is the thorough check to call before actually making an HTTP request.
 * For input validation only (e.g. in UI), use validateUrl() instead.
 *
 * @param rawUrl - URL string to validate
 * @returns Promise<SsrfValidationResult>
 */
export async function resolveAndValidate(rawUrl: string): Promise<SsrfValidationResult> {
  // First run the fast static check
  const staticResult = validateUrl(rawUrl);
  if (!staticResult.allowed) {
    return staticResult;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, url: rawUrl, reason: 'Invalid URL: could not be parsed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Skip DNS lookup for literal IPs (already checked by validateUrl)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(':')) {
    return staticResult;
  }

  // DNS rebinding protection: look up the hostname and verify the resolved IP
  try {
    const { address } = await dnsLookup(hostname);
    if (isPrivateIp(address)) {
      return {
        allowed: false,
        url: staticResult.url,
        reason: `Hostname "${hostname}" resolves to private IP "${address}" (DNS rebinding attack)`,
      };
    }
    if (BLOCKED_METADATA_HOSTS.has(address)) {
      return {
        allowed: false,
        url: staticResult.url,
        reason: `Hostname "${hostname}" resolves to blocked metadata IP "${address}"`,
      };
    }
  } catch {
    // DNS resolution failure -- allow-list handles trusted hosts; for unknown
    // hosts, fail-open (do not block on DNS timeout to avoid DoS).
    // In strict mode callers can treat DNS errors as failures themselves.
  }

  return staticResult;
}

/**
 * Check whether a tool's parameter map contains any URL-valued parameters
 * and validate all of them. Returns the first blocked result found, or
 * { allowed: true } if all pass.
 *
 * Used by toolEngine.ts to validate URL params before executing tools.
 *
 * @param params - Tool parameter map from the LLM
 * @returns SsrfValidationResult (allowed=true if no URL params or all pass)
 * @pure
 */
export function validateToolUrlParams(params: Record<string, unknown>): SsrfValidationResult {
  const urlParamNames = ['url', 'endpoint', 'baseUrl', 'targetUrl', 'apiUrl', 'webhookUrl'];

  for (const paramName of urlParamNames) {
    const value = params[paramName];
    if (typeof value === 'string' && value.trim() !== '') {
      const result = validateUrl(value);
      if (!result.allowed) {
        return { ...result, reason: `[param: ${paramName}] ${result.reason ?? 'Blocked by SSRF policy'}` };
      }
    }
  }

  return { allowed: true, url: '' };
}
