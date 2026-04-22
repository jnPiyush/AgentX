---
inputs:
 project_name:
 description: "Name of the project or system"
 required: true
 default: ""
 issue_number:
 description: "GitHub issue number"
 required: true
 default: ""
 author:
 description: "Document author"
 required: false
 default: "Security Architect"
 date:
 description: "Creation date (YYYY-MM-DD)"
 required: false
 default: "${current_date}"
---

# Security Plan: ${project_name}

**Issue**: #${issue_number}
**Status**: Draft | Review | Approved
**Author**: ${author}
**Date**: ${date}
**Classification**: {Public | Internal | Confidential}

---

## Table of Contents

1. [Security Overview](#1-security-overview)
2. [Threat Model](#2-threat-model)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Data Protection](#4-data-protection)
5. [Network Security](#5-network-security)
6. [Secrets Management](#6-secrets-management)
7. [Monitoring & Incident Response](#7-monitoring--incident-response)
8. [GenAI & LLM Security](#8-genai--llm-security) *(if applicable)*
9. [MCP Security](#9-mcp-security) *(if applicable)*
10. [Compliance](#10-compliance)
11. [Security Checklist](#11-security-checklist)

---

> **Diagram policy**: Mermaid is the default format for all diagrams in this security plan (threat models, trust boundaries, auth flows, network zones). Use PlantUML, draw.io, Structurizr, or Graphviz only when Mermaid cannot express the intent, a Visio (.vsdx) round-trip is required, or the user explicitly requests another format. See the [diagram-as-code skill](../skills/diagrams/diagram-as-code/SKILL.md). When falling back, record the reason in a header comment.

---

## 1. Security Overview

### System Description

{Brief description of what is being secured - 2-3 sentences.}

### Security Objectives

| Objective | Priority | Description |
|-----------|----------|-------------|
| Confidentiality | {High/Med/Low} | {Protect sensitive data from unauthorized access} |
| Integrity | {High/Med/Low} | {Ensure data is not tampered with} |
| Availability | {High/Med/Low} | {Maintain service uptime requirements} |

### Trust Boundaries

```mermaid
graph TD
 subgraph Public[" Internet / Public"]
 direction LR
 GW["API Gateway"]
 CDN["CDN / WAF"]
 end

 subgraph Internal[" Internal Network"]
 direction LR
 APP["Application Tier"]
 BG["Background Services"]
 end

 subgraph Data[" Data Tier"]
 direction LR
 DB["Database Tier"]
 CACHE["Cache Tier"]
 end

 Public --> Internal --> Data

 style Public fill:#FFEBEE,stroke:#C62828
 style Internal fill:#FFF3E0,stroke:#E65100
 style Data fill:#E8F5E9,stroke:#2E7D32
```

---

## 2. Threat Model

### STRIDE Analysis

| Category | Threat | Likelihood | Impact | Mitigation | Status |
|----------|--------|-----------|--------|------------|--------|
| **Spoofing** | {Unauthorized identity claim} | {Low/Med/High} | {Low/Med/High} | {Mitigation strategy} | {Open/Mitigated} |
| **Tampering** | {Data modification in transit} | {Low/Med/High} | {Low/Med/High} | {Mitigation strategy} | {Open/Mitigated} |
| **Repudiation** | {Action without audit trail} | {Low/Med/High} | {Low/Med/High} | {Mitigation strategy} | {Open/Mitigated} |
| **Info Disclosure** | {Sensitive data leak} | {Low/Med/High} | {Low/Med/High} | {Mitigation strategy} | {Open/Mitigated} |
| **Denial of Service** | {Service unavailability} | {Low/Med/High} | {Low/Med/High} | {Mitigation strategy} | {Open/Mitigated} |
| **Elevation** | {Unauthorized privilege gain} | {Low/Med/High} | {Low/Med/High} | {Mitigation strategy} | {Open/Mitigated} |

### Risk Register

| ID | Risk | Probability | Impact | Risk Score | Owner | Mitigation | Target Date |
|----|------|------------|--------|-----------|-------|------------|-------------|
| R1 | {Description} | {1-5} | {1-5} | {P x I} | {Name} | {Plan} | {Date} |

---

## 3. Authentication & Authorization

### Authentication Method

| Component | Method | Provider |
|-----------|--------|----------|
| User-facing app | {OAuth 2.0 / OIDC / SAML} | {Azure AD / Auth0 / Custom} |
| API | {JWT / API Key / mTLS} | {Azure AD / Custom} |
| Service-to-service | {Managed Identity / Client Credentials} | {Azure AD} |

### Authorization Model

- [ ] RBAC (Role-Based Access Control)
- [ ] ABAC (Attribute-Based Access Control)
- [ ] Least privilege principle enforced
- [ ] Permission boundaries documented

### Roles

| Role | Permissions | Assignment |
|------|------------|------------|
| Admin | Full access | {Manual assignment} |
| User | Read/Write own data | {Self-registration} |
| Service | API access only | {Managed Identity} |

---

## 4. Data Protection

### Data Classification

| Data Type | Classification | Encryption at Rest | Encryption in Transit |
|-----------|---------------|--------------------|-----------------------|
| User PII | Confidential | AES-256 | TLS 1.2+ |
| Auth tokens | Secret | AES-256 | TLS 1.2+ |
| App config | Internal | {Yes/No} | TLS 1.2+ |
| Public content | Public | N/A | TLS 1.2+ |

### Encryption Standards

- **At rest**: AES-256 (Azure Storage Service Encryption / SQL TDE)
- **In transit**: TLS 1.2+ (enforce `HTTPS only`)
- **Key management**: Azure Key Vault with HSM backing
- **Rotation**: Keys rotated every {90/180/365} days

---

## 5. Network Security

### Network Architecture

- [ ] Virtual Network with subnet isolation
- [ ] Network Security Groups (NSGs) with deny-all default
- [ ] Private Endpoints for PaaS services (no public endpoints)
- [ ] WAF (Web Application Firewall) for internet-facing services
- [ ] DDoS Protection Standard enabled

### Allowed Traffic

| Source | Destination | Port | Protocol | Purpose |
|--------|------------|------|----------|---------|
| Internet | WAF/LB | 443 | HTTPS | User traffic |
| App subnet | DB subnet | {5432/1433} | TCP | Database access |
| App subnet | Redis subnet | 6380 | TCP | Cache access |

---

## 6. Secrets Management

### Secret Storage

| Secret Type | Storage | Rotation | Access Method |
|-------------|---------|----------|---------------|
| DB password | Key Vault | 90 days | Managed Identity |
| API keys | Key Vault | 180 days | Managed Identity |
| Certificates | Key Vault | Auto-renew | Managed Identity |
| Connection strings | App Configuration | Reference to KV | Managed Identity |

### Rules

- MUST NOT hardcode secrets in source code
- MUST NOT store secrets in environment variables (use Key Vault references)
- MUST use Managed Identity for all Azure service authentication
- MUST enable secret scanning in CI/CD pipeline
- MUST audit secret access via Key Vault diagnostics

---

## 7. Monitoring & Incident Response

### Security Monitoring

| Signal | Tool | Alert Threshold | Response |
|--------|------|----------------|----------|
| Failed logins | {Azure Monitor / Application Insights} | >{5} in {5} min | Auto-block IP |
| Privilege escalation | {Microsoft Defender} | Any occurrence | Page on-call |
| Secret access | {Key Vault diagnostics} | Outside business hours | Alert team |
| Dependency vulnerability | {Dependabot / Snyk} | Critical/High | Block deploy |

### Incident Response Plan

1. **Detect**: Automated alerts via monitoring stack
2. **Triage**: On-call classifies severity (P0-P3)
3. **Contain**: Isolate affected component (network rules, disable access)
4. **Eradicate**: Patch vulnerability, rotate credentials
5. **Recover**: Restore from backup, verify integrity
6. **Post-mortem**: Document timeline, root cause, prevention measures

---

## 8. GenAI & LLM Security (if applicable)

> **Trigger**: Include this section when the system uses LLMs, AI agents, or GenAI inference.
> Skip if no AI/ML components exist.

### GenAI Threat Landscape

```mermaid
graph TD
 subgraph Threats["GenAI Attack Surface"]
 direction TB

 subgraph Input["Input Threats"]
 PI["Prompt Injection\n(direct + indirect)"]
 JB["Jailbreak\nAttempts"]
 ADV["Adversarial\nInputs"]
 end

 subgraph Model["Model Threats"]
 HALL["Hallucination\n(false facts)"]
 LEAK["Training Data\nLeakage"]
 BIAS["Bias &\nFairness"]
 end

 subgraph Output["Output Threats"]
 EXFIL["Data\nExfiltration"]
 CODE["Malicious Code\nGeneration"]
 PRIV["PII\nExposure"]
 end

 subgraph Ops["Operational Threats"]
 COST["Cost / Token\nExhaustion"]
 DRIFT["Silent Model\nDegradation"]
 SUPPLY["Model Supply\nChain"]
 end
 end

 style Input fill:#FFEBEE,stroke:#C62828
 style Model fill:#FFF3E0,stroke:#E65100
 style Output fill:#FCE4EC,stroke:#AD1457
 style Ops fill:#E3F2FD,stroke:#1565C0
```

### OWASP LLM Top 10 Assessment

| # | Threat | Applicable? | Mitigation | Status |
|---|--------|-------------|------------|--------|
| LLM01 | Prompt Injection | {Yes/No} | {Input sanitization, system prompt hardening, output validation} | {Open/Mitigated} |
| LLM02 | Insecure Output Handling | {Yes/No} | {Output validation, escaping, structured output enforcement} | {Open/Mitigated} |
| LLM03 | Training Data Poisoning | {Yes/No} | {Data provenance, validation, curated datasets} | {Open/Mitigated} |
| LLM04 | Model Denial of Service | {Yes/No} | {Rate limiting, token budgets, request size limits} | {Open/Mitigated} |
| LLM05 | Supply Chain Vulnerabilities | {Yes/No} | {Model pinning, vendor assessment, fallback providers} | {Open/Mitigated} |
| LLM06 | Sensitive Information Disclosure | {Yes/No} | {PII filtering, output scanning, system prompt protection} | {Open/Mitigated} |
| LLM07 | Insecure Plugin/Tool Design | {Yes/No} | {Input validation per tool, least-privilege, no shell exec} | {Open/Mitigated} |
| LLM08 | Excessive Agency | {Yes/No} | {Human-in-the-loop, tool restrictions, confirmation prompts} | {Open/Mitigated} |
| LLM09 | Overreliance | {Yes/No} | {Confidence scoring, human review, factual grounding} | {Open/Mitigated} |
| LLM10 | Model Theft | {Yes/No} | {API key rotation, access logging, usage monitoring} | {Open/Mitigated} |

### Prompt Injection Defense

```mermaid
graph LR
 subgraph Defense["Defense-in-Depth for Prompt Injection"]
 direction LR
 IN["User Input"] --> F1["Layer 1:\nInput Filter\n(pattern matching)"]
 F1 --> F2["Layer 2:\nSystem Prompt\nHardening"]
 F2 --> F3["Layer 3:\nModel Inference"]
 F3 --> F4["Layer 4:\nOutput Validator\n(structured output)"]
 F4 --> F5["Layer 5:\nAction Gate\n(confirm destructive)"]
 F5 --> OUT["Safe Output"]
 end

 style F1 fill:#FFEBEE,stroke:#C62828
 style F2 fill:#FFF3E0,stroke:#E65100
 style F3 fill:#F3E5F5,stroke:#6A1B9A
 style F4 fill:#E8F5E9,stroke:#2E7D32
 style F5 fill:#E3F2FD,stroke:#1565C0
```

**Defense Layers:**
1. **Input Filter**: Block known injection patterns, enforce character limits, sanitize
2. **System Prompt Hardening**: Instruction hierarchy, role boundaries, canary tokens
3. **Model Inference**: Use models with strong instruction-following (e.g., system prompt priority)
4. **Output Validator**: Enforce structured output schema, reject unexpected formats
5. **Action Gate**: Require confirmation for destructive actions (delete, send, deploy)

### Guardrails Configuration

| Guardrail | Type | Trigger | Action |
|-----------|------|---------|--------|
| Topic boundary | Input | Query outside defined scope | Polite refusal + redirect |
| PII detection | Output | PII in generated response | Redact before returning |
| Content safety | Input/Output | Harmful / inappropriate content | Block + log incident |
| Token budget | Input | Request exceeds token limit | Reject with size error |
| Hallucination check | Output | Low groundedness score | Flag for human review |

---

## 9. MCP Security (if applicable)

> **Trigger**: Include this section when the system exposes an MCP Server or MCP App.
> Skip if no MCP components exist.

### MCP Attack Surface

```mermaid
graph TD
 subgraph MCPThreats["MCP Security Concerns"]
 direction TB

 subgraph ToolThreats["Tool Layer"]
 TI["Tool Input\nInjection"]
 PE["Privilege\nEscalation"]
 SE["Side Effect\nAbuse"]
 end

 subgraph ResourceThreats["Resource Layer"]
 PT["Path\nTraversal"]
 SSRF["SSRF via\nResource URI"]
 DL["Data\nLeakage"]
 end

 subgraph TransportThreats["Transport Layer"]
 MITM["Man-in-the-Middle\n(SSE/HTTP)"]
 AUTH["Auth\nBypass"]
 DOS["Denial of\nService"]
 end
 end

 style ToolThreats fill:#FFEBEE,stroke:#C62828
 style ResourceThreats fill:#FFF3E0,stroke:#E65100
 style TransportThreats fill:#E3F2FD,stroke:#1565C0
```

### MCP Security Controls

| Control | Implementation | Status |
|---------|---------------|--------|
| **Tool input validation** | JSON Schema validation on all parameters | {TODO/Done} |
| **Path sandboxing** | Restrict file access to allowed directories | {TODO/Done} |
| **SSRF prevention** | URL allowlist for external requests | {TODO/Done} |
| **Rate limiting** | Max {N} tool calls per minute per session | {TODO/Done} |
| **Authentication** | {OAuth / API key / stdio (no auth needed)} | {TODO/Done} |
| **Transport encryption** | TLS 1.2+ for SSE/HTTP transports | {TODO/Done} |
| **Audit logging** | Log all tool invocations with context | {TODO/Done} |
| **Error sanitization** | No system internals in error responses | {TODO/Done} |
| **Destructive action gate** | Require confirmation for write/delete tools | {TODO/Done} |

> **Reference**: Read `.github/skills/ai-systems/mcp-server-development/SKILL.md` for MCP security patterns.

---

## 10. Compliance

### Applicable Standards

- [ ] OWASP Top 10 (2021) reviewed
- [ ] OWASP AI Top 10 reviewed (if AI/ML components)
- [ ] Azure Well-Architected Framework Security Pillar
- [ ] {GDPR / HIPAA / SOC 2 / PCI-DSS - as applicable}

### Compliance Checklist

- [ ] Data residency requirements met
- [ ] Right to deletion (GDPR Art. 17) implemented
- [ ] Audit logging enabled for compliance-relevant operations
- [ ] Data processing agreements in place with third parties

---

## 11. Security Checklist

### Pre-Deployment

- [ ] STRIDE threat model completed (Section 2)
- [ ] Authentication and authorization configured (Section 3)
- [ ] Data encryption enabled (at rest + in transit) (Section 4)
- [ ] Network isolation applied (private endpoints, NSGs) (Section 5)
- [ ] Secrets stored in Key Vault (not in code) (Section 6)
- [ ] Monitoring and alerts configured (Section 7)
- [ ] Dependency vulnerability scan passed
- [ ] Security code review completed
- [ ] Penetration testing scheduled (if applicable)

### GenAI Pre-Deployment (if applicable)

- [ ] OWASP LLM Top 10 assessment completed (Section 8)
- [ ] Prompt injection defenses tested
- [ ] Guardrails configured and validated
- [ ] PII filtering verified on model outputs
- [ ] Model version pinned with evaluation baseline
- [ ] Token budgets and rate limits configured
- [ ] Fallback model/provider configured

### MCP Pre-Deployment (if applicable)

- [ ] All tool inputs validated with JSON Schema (Section 9)
- [ ] Path traversal prevention tested
- [ ] SSRF prevention validated
- [ ] Rate limiting configured
- [ ] Transport encryption enabled (if SSE/HTTP)
- [ ] Destructive action confirmation gates active
- [ ] Audit logging enabled for all tool calls

### Post-Deployment

- [ ] Security alerts validated (test fire)
- [ ] Incident response plan tested
- [ ] Access reviews scheduled (quarterly)
- [ ] Secret rotation verified

---

**Generated by AgentX Architect Agent** 
**Last Updated**: {YYYY-MM-DD} 
**Version**: 1.0
