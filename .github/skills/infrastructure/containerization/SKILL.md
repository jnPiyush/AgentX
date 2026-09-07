---
name: "containerization"
description: 'Apply container and orchestration best practices with Docker, Docker Compose, and Kubernetes. Use when writing Dockerfiles, creating docker-compose configurations, deploying to Kubernetes, optimizing container images, or troubleshooting container networking.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 platforms: ["windows", "linux", "macos"]
---

# Containerization & Orchestration

> Build, ship, and run applications with Docker and Kubernetes following production best practices.

## When to Use

Use this skill when container image, compose, or Kubernetes decisions affect build security, runtime behavior, or delivery posture.

## Prerequisites

- The app's runtime, port, and health model are known.
- A base image strategy and registry target are defined.
- Security and runtime configuration will stay outside the image where appropriate.

## Decision Guide

Use multi-stage builds for production images, non-root users by default, and Compose only for local or simple multi-service workflows. Move to Kubernetes when scheduling, scaling, or policy controls are real operating requirements, not aspirational labels.

## Why This Is a Skill

Container defects often hide at the build/runtime seam: bloated images, root execution, leaked secrets, and mismatched orchestration assumptions. This skill keeps those seams explicit.

## Workflow

1. Choose the base image and build stages deliberately.
2. Build a minimal runtime image with explicit user, port, and health behavior.
3. Add compose or Kubernetes resources only for real operational needs.
4. Validate security, startup, and runtime wiring before publish.

## Error Handling

If image provenance, runtime user, secret handling, or health behavior is unclear, stop before publish. Treat root execution, external bundle dependencies, or mismatched orchestration assumptions as deployment defects.

## Checklist

Before handoff, confirm the image is multi-stage where appropriate, runtime is non-root, secrets stay out of layers, health behavior is explicit, and the chosen orchestration surface matches the real operating model.

## Decision Tree

MUST read before implementation: [Build, compose, and runtime patterns](references/details-build-compose-and-runtime-patterns.md#decision-tree).

## Quick Start

MUST read before implementation: [Build, compose, and runtime patterns](references/details-build-compose-and-runtime-patterns.md#quick-start).

## Dockerfile Best Practices

MUST read before implementation: [Build, compose, and runtime patterns](references/details-build-compose-and-runtime-patterns.md#dockerfile-best-practices).

<a id="multi-stage-builds-recommended"></a>

<a id="net-multi-stage"></a>

<a id="python-multi-stage"></a>

## Core Rules

### 1. Image Security

- **Non-root user**: Always `USER appuser` - never run as root
- **Minimal base**: Use `-alpine` or `-slim` variants
- **No secrets in images**: Use build args for build-time, env vars for runtime
- **Pin versions**: `FROM node:24.14.1-alpine`, not `FROM node:latest`
- **Scan images**: `docker scout quickview` or `trivy image <name>`

### 2. Layer Optimization

- **Copy dependency files first**: `COPY package*.json ./` -> `RUN npm ci` -> `COPY . .`
- **Combine RUN commands**: Reduce layers with `&&`
- **Use .dockerignore**: Exclude `node_modules`, `.git`, `dist`, test files
- **Multi-stage builds**: Build stage with dev deps, production stage with runtime only

### 3. Docker Compose

```yaml
# docker-compose.yml
services:
 api:
 build:
 context: .
 dockerfile: Dockerfile
 target: production
 ports:
 - "3000:3000"
 environment:
 - DATABASE_URL=postgres://user:pass@db:5432/app
 depends_on:
 db:
 condition: service_healthy
 healthcheck:
 test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
 interval: 10s
 retries: 3

 db:
 image: postgres:16-alpine
 environment:
 POSTGRES_USER: user
 POSTGRES_PASSWORD: pass
 POSTGRES_DB: app
 volumes:
 - pgdata:/var/lib/postgresql/data
 healthcheck:
 test: ["CMD-SHELL", "pg_isready -U user"]
 interval: 5s
 retries: 5

volumes:
 pgdata:
```

### 4. Kubernetes Essentials

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
 name: my-app
spec:
 replicas: 3
 selector:
 matchLabels:
 app: my-app
 template:
 metadata:
 labels:
 app: my-app
 spec:
 containers:
 - name: my-app
 image: myregistry.azurecr.io/my-app:1.0.0
 ports:
 - containerPort: 3000
 resources:
 requests:
 cpu: "100m"
 memory: "128Mi"
 limits:
 cpu: "500m"
 memory: "512Mi"
 readinessProbe:
 httpGet:
 path: /health
 port: 3000
 initialDelaySeconds: 5
 periodSeconds: 10
 livenessProbe:
 httpGet:
 path: /health
 port: 3000
 initialDelaySeconds: 15
 periodSeconds: 20
```

### 5. .dockerignore

```
node_modules
.git
.github
dist
*.md
.env*
.vscode
__pycache__
*.pyc
bin/
obj/
```

## Anti-Patterns

MUST read before implementation: [Build, compose, and runtime patterns](references/details-build-compose-and-runtime-patterns.md#anti-patterns).

## Scripts

MUST read before implementation: [Build, compose, and runtime patterns](references/details-build-compose-and-runtime-patterns.md#scripts).

## Quick Commands

MUST read before implementation: [Build, compose, and runtime patterns](references/details-build-compose-and-runtime-patterns.md#quick-commands).

## References

- [Build, compose, and runtime patterns](references/details-build-compose-and-runtime-patterns.md) - must read before implementation.
