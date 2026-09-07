# blazor: Quick Reference, Blazor Hosting Models, Component Structure

> MUST read before work involving **quick reference, blazor hosting models, component structure**. This reference preserves complete source guidance relocated for context-budget compliance.

## Quick Reference

| Need | Solution | Pattern |
|------|----------|---------|
| **Component** | Razor component | `@code { }` block |
| **Data binding** | Two-way binding | `@bind="propertyName"` |
| **Event handling** | Click events | `@onclick="HandleClick"` |
| **Dependency injection** | Inject services | `@inject IUserService UserService` |
| **Routing** | Page directive | `@page "/users/{UserId:int}"` |
| **Lifecycle** | Async initialization | `protected override async Task OnInitializedAsync()` |

---

## Blazor Hosting Models

### Blazor Server
- Runs on server, updates sent via SignalR
- Full .NET runtime on server
- Small download size, fast initial load
- Requires persistent connection

### Blazor WebAssembly
- Runs in browser via WebAssembly
- Larger initial download
- Works offline after loading
- No server connection needed after initial load

### Blazor United (.NET 8+)
- Combines Server and WebAssembly
- Progressive enhancement
- Optimal performance

**Choose Server for**: Line-of-business apps, intranet, backend-heavy applications 
**Choose WebAssembly for**: Public-facing apps, offline support, minimal server load

---

## Component Structure

```razor
@* Counter.razor - Basic component *@
@page "/counter"

<h1>Counter</h1>

<p>Current count: @currentCount</p>

<button class="btn btn-primary" @onclick="IncrementCount">
 Click me
</button>

@code {
 private int currentCount = 0;

 private void IncrementCount()
 {
 currentCount++;
 }
}
```

---

## Resources

- **Blazor Docs**: [learn.microsoft.com/aspnet/core/blazor](https://learn.microsoft.com/aspnet/core/blazor)
- **bUnit Testing**: [bunit.dev](https://bunit.dev)
- **Blazor WebAssembly**: [learn.microsoft.com](https://learn.microsoft.com/aspnet/core/blazor/hosting-models)
- **Awesome Blazor**: [github.com/AdrienTorris/awesome-blazor](https://github.com/AdrienTorris/awesome-blazor)
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../../Skills.md) - [AGENTS.md](../../../../../AGENTS.md)

**Last Updated**: January 27, 2026

## References

- [Component Patterns](component-patterns.md)
- [Di Routing Jsinterop](di-routing-jsinterop.md)
- [State Perf Testing](state-perf-testing.md)