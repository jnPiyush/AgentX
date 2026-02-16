#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Generate a production-ready Dockerfile for a project.

.DESCRIPTION
 Auto-detects project type and generates a multi-stage Dockerfile following
 best practices: non-root user, minimal layers, .dockerignore, health checks.

.PARAMETER Path
 Project root path. Default: current directory.

.PARAMETER Output
 Output file path. Default: ./Dockerfile

.PARAMETER Port
 Application port to expose. Default: auto-detected or 8080.

.EXAMPLE
 .\generate-dockerfile.ps1
 .\generate-dockerfile.ps1 -Path ./src -Port 5000
#>
param(
 [string]$Path = ".",
 [string]$Output = "./Dockerfile",
 [int]$Port = 0
)

$ErrorActionPreference = "Stop"

function Write-Header { param([string]$Text); Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Info { param([string]$Text); Write-Host " INFO: $Text" -ForegroundColor Yellow }

# Detect project type
function Get-ProjectType {
 param([string]$P)
 if (Get-ChildItem -Path $P -Filter "*.csproj" -ErrorAction SilentlyContinue | Select-Object -First 1) { return "dotnet" }
 if (Test-Path (Join-Path $P "pyproject.toml") -or (Test-Path (Join-Path $P "requirements.txt"))) { return "python" }
 if (Test-Path (Join-Path $P "package.json")) {
 $pkg = Get-Content (Join-Path $P "package.json") | ConvertFrom-Json
 if ($pkg.dependencies.PSObject.Properties.Name -contains "next") { return "nextjs" }
 if ($pkg.dependencies.PSObject.Properties.Name -contains "react") { return "react" }
 return "node"
 }
 if (Test-Path (Join-Path $P "go.mod")) { return "go" }
 if (Test-Path (Join-Path $P "Cargo.toml")) { return "rust" }
 return $null
}

$Dockerfiles = @{
 "dotnet" = @"
# -- Build stage --
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj and restore (layer caching)
COPY *.csproj ./
RUN dotnet restore

# Copy source and build
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# -- Runtime stage --
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Security: run as non-root
RUN groupadd -r appuser && useradd -r -g appuser -s /bin/false appuser
USER appuser

COPY --from=build /app/publish .

EXPOSE {PORT}
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
 CMD curl -f http://localhost:{PORT}/health || exit 1

ENTRYPOINT ["dotnet", "App.dll"]
"@

 "python" = @"
# -- Build stage --
FROM python:3.12-slim AS builder
WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# -- Runtime stage --
FROM python:3.12-slim AS runtime
WORKDIR /app

# Security: run as non-root
RUN groupadd -r appuser && useradd -r -g appuser -s /bin/false appuser

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

USER appuser

EXPOSE {PORT}
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:{PORT}/health')" || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "{PORT}"]
"@

 "node" = @"
# -- Build stage --
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (layer caching)
COPY package*.json ./
RUN npm ci --only=production

# -- Runtime stage --
FROM node:20-alpine AS runtime
WORKDIR /app

# Security: run as non-root
RUN addgroup -S appuser && adduser -S appuser -G appuser

COPY --from=builder /app/node_modules ./node_modules
COPY . .

USER appuser

EXPOSE {PORT}
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
 CMD wget --no-verbose --spider http://localhost:{PORT}/health || exit 1

CMD ["node", "server.js"]
"@

 "nextjs" = @"
# -- Dependencies --
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# -- Build --
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# -- Runtime --
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S appuser && adduser -S appuser -G appuser

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER appuser

EXPOSE {PORT}
CMD ["node", "server.js"]
"@

 "go" = @"
# -- Build stage --
FROM golang:1.22-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server .

# -- Runtime stage --
FROM alpine:3.19 AS runtime

RUN apk --no-cache add ca-certificates
RUN addgroup -S appuser && adduser -S appuser -G appuser

COPY --from=builder /app/server /usr/local/bin/server

USER appuser

EXPOSE {PORT}
HEALTHCHECK --interval=30s --timeout=3s CMD wget --spider http://localhost:{PORT}/health || exit 1

ENTRYPOINT ["server"]
"@

 "rust" = @"
# -- Build stage --
FROM rust:1.77-slim AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

COPY . .
RUN cargo build --release

# -- Runtime stage --
FROM debian:bookworm-slim AS runtime

RUN groupadd -r appuser && useradd -r -g appuser appuser
COPY --from=builder /app/target/release/app /usr/local/bin/app

USER appuser

EXPOSE {PORT}
ENTRYPOINT ["app"]
"@
}

$Dockerignore = @"
.git
.gitignore
.dockerignore
Dockerfile
docker-compose*.yml
node_modules
bin
obj
__pycache__
.venv
venv
*.md
.env
.env.*
.vscode
.idea
*.log
coverage
test-results
"@

Write-Header "Dockerfile Generator"

$projectType = Get-ProjectType -P $Path
if (-not $projectType) {
 Write-Host " Could not detect project type at: $Path" -ForegroundColor Red
 Write-Host " Supported: .NET, Python, Node.js, Next.js, Go, Rust"
 exit 1
}

Write-Info "Detected: $projectType"

# Auto-detect port
if ($Port -eq 0) {
 $Port = switch ($projectType) {
 "dotnet" { 8080 }
 "python" { 8000 }
 "node" { 3000 }
 "nextjs" { 3000 }
 "react" { 3000 }
 "go" { 8080 }
 "rust" { 8080 }
 default { 8080 }
 }
 Write-Info "Using default port: $Port"
}

$dockerfile = $Dockerfiles[$projectType]
if (-not $dockerfile) {
 $dockerfile = $Dockerfiles["node"] # fallback
}

$dockerfile = $dockerfile -replace "\{PORT\}", $Port

# Write Dockerfile
$dockerfile | Set-Content -Path $Output -Encoding UTF8
Write-Host " Created: $Output" -ForegroundColor Green

# Write .dockerignore
$ignoreFile = Join-Path (Split-Path $Output) ".dockerignore"
if (-not (Test-Path $ignoreFile)) {
 $Dockerignore | Set-Content -Path $ignoreFile -Encoding UTF8
 Write-Host " Created: $ignoreFile" -ForegroundColor Green
}

Write-Host "`n Build: docker build -t myapp ." -ForegroundColor Cyan
Write-Host " Run: docker run -p ${Port}:${Port} myapp" -ForegroundColor Cyan
