---
description: 'Blazor and WebAssembly specific instructions for building interactive web UIs with C#.'
applyTo: "**/*.razor,**/*.razor.cs,**/Blazor*"
---

# Blazor Development Instructions

## Component Architecture

### Component Structure
```csharp
@page "/counter"
@using Microsoft.AspNetCore.Components.Web

<PageTitle>Counter</PageTitle>

<h1>Counter</h1>

<p role="status">Current count: @currentCount</p>

<button class="btn btn-primary" @onclick="IncrementCount">Click me</button>

@code {
 private int currentCount = 0;

 private void IncrementCount()
 {
 currentCount++;
 }
}
```

### Component Best Practices
- Use `@page` directive for routable components
- Separate component logic into `.razor.cs` partial classes for complex components
- Use `@inject` for dependency injection
- Prefer `EventCallback<T>` over `Action<T>` for component parameters

## State Management

### Component State
```csharp
// Simple state
private int count = 0;

// Complex state with notification
private List<Item> items = new();

private async Task LoadItems()
{
 items = await ItemService.GetItemsAsync();
 StateHasChanged(); // Only needed if called from non-UI thread
}
```

### Cascading Values
```razor
<!-- Parent -->
<CascadingValue Value="@theme">
 <ChildComponent />
</CascadingValue>

<!-- Child -->
@code {
 [CascadingParameter]
 public Theme Theme { get; set; } = default!;
}
```

### State Container Pattern
```csharp
public class AppState
{
 public event Action? OnChange;

 private string _username = "";
 public string Username
 {
 get => _username;
 set
 {
 _username = value;
 NotifyStateChanged();
 }
 }

 private void NotifyStateChanged() => OnChange?.Invoke();
}

// Register in Program.cs
builder.Services.AddScoped<AppState>();
```

## Forms and Validation

### EditForm with DataAnnotations
```razor
<EditForm Model="@user" OnValidSubmit="HandleValidSubmit">
 <DataAnnotationsValidator />
 <ValidationSummary />

 <div class="form-group">
 <label for="name">Name</label>
 <InputText id="name" @bind-Value="user.Name" class="form-control" />
 <ValidationMessage For="@(() => user.Name)" />
 </div>

 <button type="submit" class="btn btn-primary">Submit</button>
</EditForm>

@code {
 private User user = new();

 private async Task HandleValidSubmit()
 {
 await UserService.SaveAsync(user);
 }
}
```

### Custom Validation
```csharp
public class UniqueEmailAttribute : ValidationAttribute
{
 protected override ValidationResult? IsValid(object? value, ValidationContext context)
 {
 var service = context.GetRequiredService<IUserService>();
 if (service.EmailExists((string)value!))
 {
 return new ValidationResult("Email already exists");
 }
 return ValidationResult.Success;
 }
}
```

## Component Communication

### Parent to Child (Parameters)
```razor
<!-- Parent -->
<ChildComponent Title="Hello" OnClick="HandleClick" />

<!-- Child -->
@code {
 [Parameter]
 public string Title { get; set; } = "";

 [Parameter]
 public EventCallback OnClick { get; set; }
}
```

### Child to Parent (EventCallback)
```razor
<!-- Child -->
<button @onclick="NotifyParent">Click</button>

@code {
 [Parameter]
 public EventCallback<string> OnNotify { get; set; }

 private async Task NotifyParent()
 {
 await OnNotify.InvokeAsync("Hello from child");
 }
}
```

## JavaScript Interop

### Calling JavaScript from C#
```csharp
@inject IJSRuntime JS

private async Task ShowAlert()
{
 await JS.InvokeVoidAsync("alert", "Hello!");
}

private async Task<string> GetValue()
{
 return await JS.InvokeAsync<string>("localStorage.getItem", "key");
}
```

### Calling C# from JavaScript
```csharp
// Create reference
private DotNetObjectReference<MyComponent>? objRef;

protected override void OnInitialized()
{
 objRef = DotNetObjectReference.Create(this);
}

[JSInvokable]
public void ReceiveData(string data)
{
 // Handle data from JS
}

public void Dispose() => objRef?.Dispose();
```

## Lifecycle Methods

```csharp
@code {
 // Called first, sync only
 protected override void OnInitialized() { }

 // Called first, async
 protected override async Task OnInitializedAsync() { }

 // Called when parameters change
 protected override void OnParametersSet() { }
 protected override async Task OnParametersSetAsync() { }

 // Called after render
 protected override void OnAfterRender(bool firstRender)
 {
 if (firstRender)
 {
 // First render only - JS interop safe here
 }
 }
 protected override async Task OnAfterRenderAsync(bool firstRender) { }

 // Cleanup
 public void Dispose() { }
 public async ValueTask DisposeAsync() { }
}
```

## Performance

### Virtualization for Large Lists
```razor
<Virtualize Items="@items" Context="item">
 <ItemContent>
 <div>@item.Name</div>
 </ItemContent>
 <Placeholder>
 <div>Loading...</div>
 </Placeholder>
</Virtualize>
```

### Prevent Unnecessary Renders
```csharp
// Implement ShouldRender
protected override bool ShouldRender()
{
 return hasDataChanged;
}

// Use @key for list rendering
@foreach (var item in items)
{
 <ItemComponent @key="item.Id" Item="item" />
}
```

## Error Handling

### Error Boundaries
```razor
<ErrorBoundary @ref="errorBoundary">
 <ChildContent>
 <RiskyComponent />
 </ChildContent>
 <ErrorContent Context="ex">
 <div class="alert alert-danger">
 An error occurred: @ex.Message
 </div>
 </ErrorContent>
</ErrorBoundary>

@code {
 private ErrorBoundary? errorBoundary;

 private void Recover()
 {
 errorBoundary?.Recover();
 }
}
```

## Security Checklist

- [ ] Use `[Authorize]` attribute for protected pages
- [ ] Validate all user input server-side
- [ ] Use HTTPS in production
- [ ] Sanitize content rendered with `MarkupString`
- [ ] Never embed secrets in client code (Blazor WASM)
- [ ] Use anti-forgery tokens for forms

## References

- [Skill #23: Blazor](.github/skills/development/blazor/SKILL.md)
- [Skill #17: C#](.github/skills/development/csharp/SKILL.md)
- [Skill #04: Security](.github/skills/architecture/security/SKILL.md)
