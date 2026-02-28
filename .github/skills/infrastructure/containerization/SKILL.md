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

- Building Docker images for applications
- Writing Docker Compose for multi-service local development
- Deploying to Kubernetes clusters
- Creating CI/CD pipelines that build and push container images
- Migrating from VMs to containers

## Decision Tree

```
Containerizing an application?
+- Single service, local dev?
| - Dockerfile only
+- Multi-service, local dev?
| - Docker Compose
+- Production deployment?
| +- Simple (1-3 services)?
| | - Docker Compose + managed hosting (Azure Container Apps, ECS)
| - Complex (many services, scaling)?
| - Kubernetes (AKS, EKS, GKE)
- CI/CD pipeline?
 - Multi-stage Dockerfile + registry push
```

## Quick Start

```bash
# Build image
docker build -t myapp:1.0 .

# Run container
docker run -d -p 3000:3000 myapp:1.0

# Multi-service (Docker Compose)
docker compose up -d

# Scan for vulnerabilities
docker scout quickview myapp:1.0
```

## Dockerfile Best Practices

### Multi-Stage Builds (Recommended)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

### .NET Multi-Stage

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
RUN adduser --disabled-password --gecos '' appuser
COPY --from=build /app/publish .
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8080/health || exit 1
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### Python Multi-Stage

```dockerfile
FROM python:3.12-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
RUN useradd --create-home appuser
COPY --from=build /app/deps /usr/local/lib/python3.12/site-packages/
COPY . .
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Core Rules

### 1. Image Security

- **Non-root user**: Always `USER appuser` - never run as root
- **Minimal base**: Use `-alpine` or `-slim` variants
- **No secrets in images**: Use build args for build-time, env vars for runtime
- **Pin versions**: `FROM node:20.11-alpine`, not `FROM node:latest`
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

- **Running as root**: Security risk - always add and switch to non-root user
- **`latest` tags**: Non-reproducible builds - pin specific versions
- **Secrets in ENV/ARG**: Use Docker secrets or mounted files for sensitive data
- **Single-stage builds**: Bloated images with build tools - use multi-stage
- **No healthchecks**: Orchestrators can't determine container health
- **bind-mounting in production**: Use volumes or copy files into the image
- **Ignoring .dockerignore**: Huge build contexts slow down builds

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [`generate-dockerfile.ps1`](scripts/generate-dockerfile.ps1) | Generate production Dockerfile (multi-stage, non-root) | `./scripts/generate-dockerfile.ps1 [-Port 8080]` |
| [`generate-compose.ps1`](scripts/generate-compose.ps1) | Scaffold docker-compose.yml with common services | `./scripts/generate-compose.ps1 -Services postgres,redis` |

## Quick Commands

| Task | Command |
|------|---------|
| Build image | `docker build -t myapp:1.0 .` |
| Run container | `docker run -d -p 3000:3000 myapp:1.0` |
| Compose up | `docker compose up -d` |
| Compose down | `docker compose down -v` |
| View logs | `docker logs -f <container>` |
| Shell into container | `docker exec -it <container> sh` |
| Scan image | `docker scout quickview myapp:1.0` |
| Push to registry | `docker push myregistry.azurecr.io/myapp:1.0` |
