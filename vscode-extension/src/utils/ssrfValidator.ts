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
// Integration: validateToolUrlParams() is called in ToolRegistry.execute()
// (toolEngine.ts) before executing any tool call.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { SsrfValidationResult } from './ssrfValidatorTypes';
export {
 addAllowedHost,
 getAllowedHosts,
 isPrivateIp,
 removeAllowedHost,
 resolveAndValidate,
 validateToolUrlParams,
 validateUrl,
} from './ssrfValidatorEngine';
