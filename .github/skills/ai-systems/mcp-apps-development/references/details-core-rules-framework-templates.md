# MCP Apps Development Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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
- [MCP Server Development Skill](..\..\mcp-server-development\SKILL.md) (for headless MCP servers)
- [MCP Specification](https://spec.modelcontextprotocol.io)
