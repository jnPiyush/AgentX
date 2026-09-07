---
name: "api-design"
description: 'Design robust REST APIs with proper versioning, pagination, error handling, rate limiting, and documentation. Use when creating new API endpoints, designing resource naming conventions, implementing pagination or filtering, adding rate limiting, or documenting APIs with OpenAPI/Swagger.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
---

# API Design

> **Purpose**: Design robust, maintainable, and user-friendly REST APIs. 
> **Focus**: Resource naming, HTTP methods, status codes, versioning, documentation. 
> **Note**: Language-agnostic patterns applicable to any tech stack.

---

## When to Use This Skill

- Designing new REST API endpoints
- Implementing pagination, filtering, or sorting
- Adding rate limiting or CORS configuration
- Documenting APIs with OpenAPI/Swagger
- Designing webhook notification systems

## Prerequisites

- HTTP protocol fundamentals
- JSON data format understanding

## Decision Guide

Design resources before endpoints. Use REST-style nouns and standard HTTP semantics when the interface is resource-centric and long-lived. Use webhooks for async events, cursor pagination for mutable large collections, and versioning before you introduce breaking changes.

## Why This Is a Skill

API defects become client contracts. This skill keeps naming, method semantics, error behavior, and versioning disciplined so convenience shortcuts do not become permanent integration debt.

## Workflow

1. Model resources, identifiers, and lifecycle actions.
2. Pick routes, methods, and response shapes that preserve idempotency and compatibility.
3. Define auth, rate limiting, pagination, filtering, and error contracts.
4. Validate the contract from a caller's perspective before implementation.

## Decision Tree

MUST read before selection: [Decision Tree details](references/details-decision-tree-restful-conventions.md#decision-tree).

## RESTful Conventions

MUST read before selection: [Decision Tree details](references/details-decision-tree-restful-conventions.md#restful-conventions).

<a id="resource-naming"></a>

<a id="resource-naming-rules"></a>

## HTTP Methods

MUST read before selection: [Decision Tree details](references/details-decision-tree-restful-conventions.md#http-methods).

<a id="standard-methods"></a>

<a id="method-usage-examples"></a>

## HTTP Status Codes

MUST read before selection: [Decision Tree details](references/details-decision-tree-restful-conventions.md#http-status-codes).

<a id="success-codes-2xx"></a>

<a id="client-error-codes-4xx"></a>

<a id="server-error-codes-5xx"></a>

## Core Rules

### Security

- [PASS] Use HTTPS everywhere
- [PASS] Implement authentication
- [PASS] Validate all inputs
- [PASS] Rate limit requests
- [PASS] Use API keys for server-to-server
- [PASS] Implement CORS properly
- [PASS] Log security events

### Performance

- [PASS] Implement caching (ETags, Cache-Control)
- [PASS] Use compression (gzip, brotli)
- [PASS] Paginate large collections
- [PASS] Support field filtering
- [PASS] Use CDN for static content
- [PASS] Monitor API performance

### Developer Experience

- [PASS] Provide clear error messages
- [PASS] Use consistent naming
- [PASS] Version your API
- [PASS] Maintain comprehensive docs
- [PASS] Provide SDK/client libraries
- [PASS] Include examples
- [PASS] Offer sandbox environment

---

## Anti-Patterns

| Pitfall | Problem | Solution |
|---------|---------|----------|
| **Overfetching** | Returning too much data | Support field selection |
| **Underfetching** | Requiring multiple requests | Support eager loading |
| **No versioning** | Breaking changes affect clients | Version from day one |
| **Inconsistent naming** | Hard to use | Follow naming conventions |
| **No pagination** | Performance issues | Always paginate collections |
| **Poor error messages** | Hard to debug | Return detailed errors |
| **No rate limiting** | API abuse | Implement rate limits |

---

## Resources

MUST read before selection: [Decision Tree details](references/details-decision-tree-restful-conventions.md#resources).

## Scripts

MUST read before selection: [Decision Tree details](references/details-decision-tree-restful-conventions.md#scripts).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors in browser | Configure Access-Control-Allow-Origin header with specific origins, not wildcards |
| Pagination inconsistency | Use cursor-based pagination for mutable datasets, offset for static |
| Rate limit bypass attempts | Implement per-user rate limiting with token bucket algorithm |

## References

- [Decision Tree details](references/details-decision-tree-restful-conventions.md) - must read before selection.
- [api-docs-webhooks](references/api-docs-webhooks.md)
- [api-response-patterns](references/api-response-patterns.md)
- [api-security-patterns](references/api-security-patterns.md)


- [Source and related-reading index](references/details-source-reference-index.md)
