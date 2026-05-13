# Deploy Prototype

Publish a UX prototype build (static HTML or SPA `dist/`) to a chosen hosting target. Thin adapter over the official CLI for each target -- the plugin never reads, stores, or transmits credentials.

## Targets

| Target | Required CLI | Install hint | Notes |
|--------|--------------|--------------|-------|
| `vercel` | `vercel` | `npm i -g vercel` | Use `-Prod` / `--prod` for production |
| `netlify` | `netlify` | `npm i -g netlify-cli` | Pass `-ProjectName` to bind to a site |
| `cloudflare` | `wrangler` | `npm i -g wrangler` | `-ProjectName` required |
| `github-pages` | `gh` + `git` | https://cli.github.com/ | Pushes the build to the chosen branch via a worktree |
| `surge` | `surge` | `npm i -g surge` | `-ProjectName` becomes `<name>.surge.sh` |

## Usage

PowerShell:

```powershell
.\.agentx\plugins\deploy-prototype\deploy-prototype.ps1 -Target vercel -BuildDir dist -Prod
.\.agentx\plugins\deploy-prototype\deploy-prototype.ps1 -Target netlify -ProjectName my-prototype -Prod
.\.agentx\plugins\deploy-prototype\deploy-prototype.ps1 -Target cloudflare -ProjectName my-prototype
.\.agentx\plugins\deploy-prototype\deploy-prototype.ps1 -Target github-pages -Branch gh-pages
.\.agentx\plugins\deploy-prototype\deploy-prototype.ps1 -Target surge -ProjectName my-prototype
```

Bash:

```bash
./.agentx/plugins/deploy-prototype/deploy-prototype.sh --target vercel --build-dir dist --prod
./.agentx/plugins/deploy-prototype/deploy-prototype.sh --target netlify --project-name my-prototype --prod
./.agentx/plugins/deploy-prototype/deploy-prototype.sh --target cloudflare --project-name my-prototype
./.agentx/plugins/deploy-prototype/deploy-prototype.sh --target github-pages --branch gh-pages
./.agentx/plugins/deploy-prototype/deploy-prototype.sh --target surge --project-name my-prototype
```

## Pre-flight

1. Build the prototype first: `npm run build` (or your equivalent). The plugin will not run unless `BuildDir` exists.
2. Make sure the chosen target's CLI is installed and logged in. The plugin reports a clean error and exits 2 if the CLI is missing from `PATH`.
3. For SPA hosts that need rewrites (Vercel, Netlify, Cloudflare), keep your `vercel.json`, `_redirects`, or `_routes.json` next to `BuildDir`.

## Security

- The plugin never embeds tokens. Each target CLI handles its own auth (interactive login, env var, or its keychain).
- No network calls are made by the plugin itself; the target CLI does the upload.
- File system permission is `read` for the build directory only.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Deploy succeeded |
| 2 | Required CLI not on `PATH` |
| 3 | `BuildDir` does not exist |
| 4 | Missing `ProjectName` when the target requires it |
| other | The target CLI's own exit code |

## See also

- `design/working-prototype-app/SKILL.md` for the build pipeline.
- `design/prototype-audit/SKILL.md` to gate deployment on a passing audit.
