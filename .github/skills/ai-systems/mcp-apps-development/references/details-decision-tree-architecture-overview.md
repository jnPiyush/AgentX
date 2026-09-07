# MCP Apps Development Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

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
