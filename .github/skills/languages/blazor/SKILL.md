---
name: "blazor"
description: 'Build Blazor applications with Razor components, lifecycle management, and C# web patterns. Use when creating Blazor Server or WebAssembly apps, building Razor components, implementing state management, adding JavaScript interop, or optimizing Blazor performance.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 languages: ["csharp"]
 frameworks: ["blazor", "dotnet", "aspnet-core"]
 platforms: ["windows", "linux", "macos"]
---

# Blazor Framework Development

> **Purpose**: Production-ready Blazor development for building interactive web applications with C#. 
> **Audience**: .NET engineers building Blazor Server or WebAssembly applications. 
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) Blazor patterns.

---

## When to Use This Skill

- Building Blazor Server or WebAssembly applications
- Creating Razor components with parameters and binding
- Implementing Blazor dependency injection
- Adding JavaScript interop to Blazor apps
- Optimizing Blazor rendering performance

## Decision Tree

```
Blazor Hosting Decision
+-- Line-of-business / intranet app?
|   +-- Server resources available? -> Blazor Server
|   +-- Need real-time updates? -> Blazor Server (SignalR)
+-- Public-facing app?
|   +-- Offline support needed? -> Blazor WebAssembly
|   +-- Minimal server load? -> Blazor WebAssembly
+-- Best of both worlds?
|   +-- .NET 8+? -> Blazor United (SSR + interactive)
|   +-- Progressive enhancement? -> Blazor United
+-- Heavy JS interop needed? -> Consider React/Angular instead
+-- Simple static site? -> Consider plain HTML/CSS or SSG
```

## Prerequisites

- C# and .NET 8+ knowledge
- Basic HTML/CSS understanding
- Visual Studio or VS Code with C# extension

## Core Rules

1. **Use Component Parameters** - Pass data via `[Parameter]` attributes; avoid direct field access across components
2. **Implement IDisposable** - Unsubscribe from events and dispose resources in `Dispose()` to prevent memory leaks
3. **Prefer OnInitializedAsync** - Use `OnInitializedAsync` for async data loading, not constructors or `OnParametersSet`
4. **Match Service Lifetimes** - Do not inject Scoped services into Singleton services; match DI lifetimes carefully
5. **Minimize JS Interop** - Keep JavaScript interop calls to a minimum; prefer C# solutions where possible
6. **Use CascadingValue Sparingly** - Reserve `CascadingValue` for truly cross-cutting concerns like theme or auth state
7. **Call StateHasChanged Correctly** - Only call `StateHasChanged()` when the framework cannot detect changes automatically
8. **Use Virtualization for Lists** - Use `<Virtualize>` for large lists instead of rendering all items at once

---

## Anti-Patterns

| Issue | Problem | Solution |
|-------|---------|----------|
| **Missing @bind** | One-way binding only | Use `@bind="property"` for two-way |
| **StateHasChanged not called** | UI doesn't update | Call `StateHasChanged()` after async operations |
| **Memory leaks** | Event handlers not removed | Implement `IDisposable` and unsubscribe |
| **Wrong lifecycle method** | Code runs at wrong time | Use `OnInitializedAsync` for async init |
| **Scoped service in Singleton** | Service lifetime mismatch | Match service lifetimes properly |
| **Missing [Parameter]** | Parameters not working | Add `[Parameter]` attribute |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Component not re-rendering | Call StateHasChanged() or ensure parameter values are new object references |
| JS interop errors | Ensure JS files loaded with script tag, use IJSRuntime for interop calls |
| Blazor WASM slow initial load | Enable AOT compilation, use lazy loading for assemblies |

## Workflow

1. Confirm hosting and render mode.
2. Define component state, parameters, and event flow.
3. Implement loading, error, and disposal behavior.
4. Run component tests and render the primary interaction.

## Verification Checklist

- [ ] Build passes for the target host.
- [ ] Parameters and nullability are valid.
- [ ] Loading/error states render.
- [ ] Primary interaction and disposal behavior are tested.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Quick Reference, Blazor Hosting Models, Component Structure](references/details-quick-reference-and-component-structure.md) - MUST read before work involving quick reference, blazor hosting models, component structure.

Existing focused references are reused, not duplicated:

- [Blazor Component Parameters, Binding & Lifecycle](references/component-patterns.md) - MUST read before applying the focused blazor component parameters, binding & lifecycle guidance.
- [Blazor DI, Routing & JavaScript Interop](references/di-routing-jsinterop.md) - MUST read before applying the focused blazor di, routing & javascript interop guidance.
- [Blazor State Management, Performance & Testing](references/state-perf-testing.md) - MUST read before applying the focused blazor state management, performance & testing guidance.
