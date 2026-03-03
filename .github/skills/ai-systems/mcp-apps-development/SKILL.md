---
name: "mcp-apps-development"
description: 'Build MCP Apps (ext-apps) that render interactive UI inside conversational AI clients. Use when creating visual tool outputs, interactive dashboards, form-based tools, or rich media experiences in MCP-compatible hosts like Claude Desktop, VS Code Copilot Chat, or other MCP clients that support the Apps specification.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-07-15"
  updated: "2025-07-15"
compatibility:
  languages: ["typescript", "javascript"]
  frameworks: ["react", "vue", "svelte", "preact", "solid", "vanillajs"]
  platforms: ["windows", "linux", "macos"]
---

# MCP Apps Development

> Build [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) that render interactive UI inside conversational AI clients using the `@modelcontextprotocol/ext-apps` SDK.

## When to Use

- Building MCP tools that display interactive UI (charts, forms, dashboards)
- Creating visual resource viewers inside AI chat interfaces
- Adding rich media output to existing MCP servers (video, maps, 3D, music)
- Migrating OpenAI chat app plugins to the MCP Apps standard
- Building fullscreen interactive experiences within MCP-compatible hosts

## When NOT to Use

- Building headless MCP servers (tools, resources, prompts only) -> use `mcp-server-development` skill
- Creating standalone web applications outside AI clients
- Building API integrations without a visual component

## Decision Tree

```
Need interactive UI in an AI chat client?
+- Tool with visual output?
|  +- Register with registerAppTool()
|  +- Return _meta.ui.resourceUri linking to a resource
|  - Resource renders the UI via App class
+- Standalone visual resource?
|  +- Register with registerAppResource()
|  - Resource renders UI, host embeds as iframe
+- Migrating from OpenAI plugin?
|  +- See Migration section below
|  - Key: synchronous globals -> async App handlers
- No UI needed?
   - Use mcp-server-development skill instead
```

## Architecture Overview

```
  ----------     PostMessage      ----------      MCP       ----------
  |  View  | <================> |   Host   | <==========> |  Server  |
  | (App)  |     (iframe)       |(AppBridge|   (Client)   | (MCP SDK)|
  | iframe |                    |  proxy)  |              |          |
  ----------                    ----------               ----------
       |                             |                        |
   App class               AppBridge class           registerAppTool()
   PostMessageTransport    proxies MCP requests      registerAppResource()
   React hooks             embeds iframe             _meta.ui.resourceUri
```

**Three Abstractions:**

| Layer | Class | Entry Point | Role |
|-------|-------|-------------|------|
| **View** | `App` | `ext-apps` | Runs inside iframe, sends/receives messages |
| **Host** | `AppBridge` | `ext-apps/app-bridge` | Embeds iframe, proxies MCP calls to client |
| **Server** | helpers | `ext-apps/server` | `registerAppTool()` / `registerAppResource()` |

## Quick Start: React MCP App

### 1. Scaffold from template

```bash
# Clone the ext-apps repo for templates
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps/templates/basic-server-react
npm install
```

### 2. Server-side: Register tool + resource

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource } from "@anthropic-ai/sdk/mcp/ext-apps/server";

const server = new McpServer({ name: "my-app-server", version: "1.0.0" });

// Register a resource that renders UI
registerAppResource(server, {
  name: "dashboard",
  uri: "app://dashboard",
  title: "Dashboard",
  handler: async () => ({
    // Return bundled HTML/JS as a single-file resource
    blob: readFileSync("dist/index.html"),
    mimeType: "text/html",
  }),
});

// Register a tool that links to the resource
registerAppTool(server, {
  name: "show-dashboard",
  description: "Display the interactive dashboard",
  parameters: { query: { type: "string" } },
  handler: async ({ query }) => ({
    content: [{ type: "text", text: `Dashboard for: ${query}` }],
    _meta: {
      ui: { resourceUri: "app://dashboard" },
    },
  }),
});
```

### 3. Client-side: React App

```tsx
import { useApp, useHostStyles, useAutoResize } from "@anthropic-ai/sdk/mcp/ext-apps/react";

function Dashboard() {
  const app = useApp();
  useHostStyles();    // Inherit host CSS variables
  useAutoResize();    // Auto-resize iframe to content

  const [data, setData] = useState(null);

  useEffect(() => {
    // Read resources or call tools via the app instance
    app.readResource("data://metrics").then(setData);
  }, [app]);

  return (
    <div style={{ fontFamily: "var(--host-font-family)" }}>
      <h1>Dashboard</h1>
      {data && <Chart data={data} />}
    </div>
  );
}
```

### 4. Build as single-file bundle

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: "dist" },
});
```

## Core Rules

### 1. Tool + Resource Pattern

Every visual tool MUST follow the tool-resource linking pattern:

- **Tool**: Handles logic, returns `_meta.ui.resourceUri` pointing to a resource
- **Resource**: Serves the UI (HTML bundle) that renders in the iframe
- **Link**: The `_meta.ui.resourceUri` in the tool response tells the host which resource to display

```
Tool call -> returns _meta.ui.resourceUri -> Host loads resource -> renders in iframe
```

### 2. Handler Registration Order

Register ALL handlers (tools, resources, event listeners) BEFORE calling `app.connect()` or `server.connect()`:

```typescript
// CORRECT: register first, connect last
app.onToolCall("search", handler);
app.onResourceRead("data://items", handler);
await app.connect(transport);

// WRONG: connecting before registering handlers
await app.connect(transport);        // handlers will be missed
app.onToolCall("search", handler);   // too late
```

### 3. Tool Visibility Model

MCP Apps have two visibility scopes for tools:

| Scope | Visible To | Use For |
|-------|-----------|---------|
| **Model-visible** | AI model + app | Tools the AI calls (search, analyze) |
| **App-only** | App iframe only | UI utility tools (sort, filter, paginate) |

Register app-only tools with visibility metadata to prevent the AI from calling UI-internal tools.

### 4. Host Styling

MUST use CSS custom properties from the host for visual consistency:

```css
body {
  font-family: var(--host-font-family, system-ui, sans-serif);
  color: var(--host-color, #1a1a1a);
  background: var(--host-background, #ffffff);
}
```

Handle safe area insets for various host layouts:

```css
.content {
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

### 5. Single-File Bundling

MCP App resources MUST be served as self-contained single-file HTML bundles. Use `vite-plugin-singlefile` to inline all CSS, JS, and assets:

```bash
npm install -D vite-plugin-singlefile
```

The host loads the resource as an iframe `srcdoc` -- external script/style references will not resolve.

### 6. Streaming Partial Input

For tools called with streaming, handle partial input via `ontoolinputpartial`:

```typescript
app.onToolCall("search", {
  handler: async ({ query }) => ({ results: search(query) }),
  ontoolinputpartial: (partial) => {
    // Update UI as partial tool input streams in
    updateSearchPreview(partial.query);
  },
});
```

### 7. Visibility-Based Resource Management

Use `IntersectionObserver` to detect when the app iframe scrolls out of view and pause expensive operations:

```typescript
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      resumeAnimation();
    } else {
      pauseAnimation();
    }
  });
});
```

### 8. Fullscreen Mode

Apps can request fullscreen rendering from the host:

```typescript
app.requestFullscreen();   // Expand to full host viewport
app.exitFullscreen();      // Return to inline iframe
```

Use sparingly -- only when content genuinely needs the full viewport (3D scenes, maps, editors).

## Framework Templates

| Framework | Template | Use When |
|-----------|----------|----------|
| React | `basic-server-react` | Component-heavy UIs, state management |
| Vue | `basic-server-vue` | Two-way bindings, Vue ecosystem |
| Svelte | `basic-server-svelte` | Minimal bundle size, reactive |
| Preact | `basic-server-preact` | React API with smaller footprint |
| Solid | `basic-server-solid` | Fine-grained reactivity, performance |
| Vanilla JS | `basic-server-vanillajs` | No framework overhead, simple UIs |

All templates include Vite build config, single-file bundling, and a basic server with `registerAppTool` / `registerAppResource` wired up.

## Migration from OpenAI Plugins

Key conceptual changes:

| OpenAI Plugin | MCP App |
|---------------|---------|
| `window.chatgpt.*` (synchronous globals) | `App` class (async handlers) |
| Plugin manifest + API spec | `registerAppTool()` + `registerAppResource()` |
| Separate frontend/backend | Single server + bundled UI resource |
| CORS configuration required | PostMessage transport (no CORS) |

**Migration checklist:**

1. Investigate CSP requirements (Content Security Policy)
2. Replace synchronous global calls with async `App` handlers
3. Bundle UI as single-file HTML (no external script/link tags)
4. Register tools with `registerAppTool()` and resources with `registerAppResource()`
5. Replace CORS config with PostMessage-based transport
6. Test with `basic-host` from the ext-apps repo

## Anti-Patterns

- **External script tags**: Embedding `<script src="...">` in app HTML -- use single-file bundling instead
- **Direct DOM globals**: Using `window.parent` or `postMessage` directly -- use the `App` class transport
- **Late handler registration**: Calling `connect()` before registering handlers -- register first, connect last
- **Ignoring host styles**: Hardcoding colors/fonts instead of using `var(--host-*)` CSS properties
- **Always-on fullscreen**: Requesting fullscreen on load -- only use when content needs it
- **Unbounded rendering**: Running animations/timers when iframe is not visible -- use IntersectionObserver
- **Manual version pinning**: Editing package.json versions by hand -- use `npm install <package>` instead
- **God-tools**: One tool handling all UI interactions -- separate into model-visible and app-only tools

## Testing

Test MCP Apps using the `basic-host` from the ext-apps repo:

```bash
# Clone ext-apps and run the test host
cd ext-apps/examples/basic-host
npm install && npm start

# In another terminal, start your server
cd my-app-server
npm run dev
```

The basic-host provides:
- An AppBridge that proxies MCP requests
- An iframe container for rendering your app
- Developer tools for inspecting PostMessage traffic

**Debugging tip**: Use `app.sendLog()` to send debug messages to the host console -- `console.log()` inside the iframe is not visible to the host.

## Project Structure

```
my-mcp-app/
+-- src/
|   +-- server/
|   |   +-- index.ts          # MCP server + registerAppTool/Resource
|   |   -- tools/
|   |       -- search.ts      # Tool implementations
|   +-- app/
|   |   +-- main.tsx          # App entry point (React/Vue/Svelte)
|   |   +-- components/       # UI components
|   |   -- styles.css         # Uses var(--host-*) CSS properties
|   -- vite.config.ts         # Single-file bundling config
+-- dist/
|   -- index.html             # Bundled single-file output
+-- package.json
-- tsconfig.json
```

## React Hooks Reference

| Hook | Purpose |
|------|---------|
| `useApp()` | Access the `App` instance for tool calls and resource reads |
| `useHostStyles()` | Inject host CSS custom properties into the document |
| `useAutoResize()` | Automatically resize iframe to fit content height |
| `useDocumentTheme()` | Sync document theme (light/dark) with host |

## Further Reading

- [MCP Apps Specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
- [ext-apps SDK Repository](https://github.com/modelcontextprotocol/ext-apps)
- [MCP Apps Examples](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples) (shadertoy, wiki-explorer, system-monitor, map, video, sheet-music, threejs)
- [MCP Server Development Skill](./../mcp-server-development/SKILL.md) (for headless MCP servers)
- [MCP Specification](https://spec.modelcontextprotocol.io)
