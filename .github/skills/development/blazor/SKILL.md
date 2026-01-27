---
description: 'Blazor framework development with Razor components, lifecycle, and C# web patterns'
---

# Blazor Framework Development

> **Purpose**: Production-ready Blazor development for building interactive web applications with C#.  
> **Audience**: .NET engineers building Blazor Server or WebAssembly applications.  
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) Blazor patterns.

---

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

## Component Parameters

```razor
@* UserCard.razor - Component with parameters *@
<div class="card">
    <h3>@User.Name</h3>
    <p>@User.Email</p>
    <button @onclick="() => OnSelect.InvokeAsync(User)">
        Select
    </button>
</div>

@code {
    [Parameter]
    public required User User { get; set; }
    
    [Parameter]
    public EventCallback<User> OnSelect { get; set; }
}

@* Usage in parent component *@
<UserCard User="@user" OnSelect="HandleUserSelect" />

@code {
    private User user = new User { Name = "John", Email = "john@example.com" };
    
    private void HandleUserSelect(User selectedUser)
    {
        Console.WriteLine($"Selected: {selectedUser.Name}");
    }
}
```

---

## Data Binding

```razor
@* Two-way data binding *@
<div>
    <label>Name:</label>
    <input @bind="userName" />
    
    @* Bind with event *@
    <input @bind="email" @bind:event="oninput" />
    
    @* Bind with format *@
    <input @bind="startDate" @bind:format="yyyy-MM-dd" />
    
    <p>Hello, @userName! (@email)</p>
</div>

@code {
    private string userName = "";
    private string email = "";
    private DateTime startDate = DateTime.Now;
}

@* ✅ GOOD: Form with validation *@
<EditForm Model="@model" OnValidSubmit="HandleValidSubmit">
    <DataAnnotationsValidator />
    <ValidationSummary />
    
    <div class="form-group">
        <label>Email:</label>
        <InputText @bind-Value="model.Email" class="form-control" />
        <ValidationMessage For="@(() => model.Email)" />
    </div>
    
    <div class="form-group">
        <label>Password:</label>
        <InputText @bind-Value="model.Password" type="password" class="form-control" />
        <ValidationMessage For="@(() => model.Password)" />
    </div>
    
    <button type="submit" class="btn btn-primary">Submit</button>
</EditForm>

@code {
    private LoginModel model = new();
    
    private async Task HandleValidSubmit()
    {
        await AuthService.LoginAsync(model.Email, model.Password);
    }
}

public class LoginModel
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = "";
    
    [Required]
    [MinLength(8)]
    public string Password { get; set; } = "";
}
```

---

## Component Lifecycle

```razor
@* UserProfile.razor - Component with lifecycle *@
@page "/users/{UserId:int}"
@inject IUserService UserService
@implements IDisposable

@if (loading)
{
    <p>Loading...</p>
}
else if (user == null)
{
    <p>User not found</p>
}
else
{
    <h1>@user.Name</h1>
    <p>@user.Email</p>
}

@code {
    [Parameter]
    public int UserId { get; set; }
    
    private User? user;
    private bool loading = true;
    private CancellationTokenSource? cts;
    
    // Called once when component is initialized
    protected override async Task OnInitializedAsync()
    {
        cts = new CancellationTokenSource();
        await LoadUserAsync();
    }
    
    // Called when parameters change
    protected override async Task OnParametersSetAsync()
    {
        await LoadUserAsync();
    }
    
    // Called after component has rendered
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            // JavaScript interop or other one-time operations
            await JS.InvokeVoidAsync("initializeChart");
        }
    }
    
    private async Task LoadUserAsync()
    {
        loading = true;
        try
        {
            user = await UserService.GetUserByIdAsync(UserId, cts!.Token);
        }
        finally
        {
            loading = false;
        }
    }
    
    // Cleanup
    public void Dispose()
    {
        cts?.Cancel();
        cts?.Dispose();
    }
}
```

---

## Dependency Injection

```csharp
// ✅ GOOD: Register services in Program.cs
var builder = WebApplication.CreateBuilder(args);

// Blazor Server
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

// Services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddSingleton<IWeatherService, WeatherService>();
builder.Services.AddTransient<IEmailService, EmailService>();

// HttpClient for WebAssembly
builder.Services.AddScoped(sp => 
    new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

var app = builder.Build();
app.Run();
```

```razor
@* ✅ GOOD: Inject services in components *@
@page "/users"
@inject IUserService UserService
@inject NavigationManager Navigation
@inject IJSRuntime JS

<h1>Users</h1>

@if (users == null)
{
    <p>Loading...</p>
}
else
{
    <table class="table">
        @foreach (var user in users)
        {
            <tr>
                <td>@user.Name</td>
                <td>@user.Email</td>
            </tr>
        }
    </table>
}

@code {
    private List<User>? users;
    
    protected override async Task OnInitializedAsync()
    {
        users = await UserService.GetAllUsersAsync();
    }
}
```

---

## Routing

```razor
@* ✅ GOOD: Route with parameters *@
@page "/products/{ProductId:int}"
@page "/products/{ProductId:int}/{Variant}"

<h1>Product @ProductId - @Variant</h1>

@code {
    [Parameter]
    public int ProductId { get; set; }
    
    [Parameter]
    public string? Variant { get; set; }
}

@* ✅ GOOD: Navigation *@
@inject NavigationManager Navigation

<button @onclick="NavigateToProducts">View Products</button>

@code {
    private void NavigateToProducts()
    {
        Navigation.NavigateTo("/products");
    }
    
    private void NavigateWithQuery()
    {
        Navigation.NavigateTo("/products?category=electronics");
    }
}
```

---

## JavaScript Interop

```razor
@* ✅ GOOD: Call JavaScript from C# *@
@inject IJSRuntime JS

<button @onclick="ShowAlert">Show Alert</button>

@code {
    private async Task ShowAlert()
    {
        await JS.InvokeVoidAsync("alert", "Hello from Blazor!");
    }
    
    private async Task<string> GetLocalStorage(string key)
    {
        return await JS.InvokeAsync<string>("localStorage.getItem", key);
    }
}
```

```javascript
// wwwroot/js/interop.js
window.blazorHelpers = {
    focusElement: function (elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.focus();
        }
    },
    
    saveToLocalStorage: function (key, value) {
        localStorage.setItem(key, value);
    }
};
```

```razor
@* Call custom JavaScript *@
@code {
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            await JS.InvokeVoidAsync("blazorHelpers.focusElement", "searchInput");
        }
    }
}
```

---

## State Management

### Cascading Parameters

```razor
@* Parent.razor *@
<CascadingValue Value="@currentUser">
    <ChildComponent />
</CascadingValue>

@code {
    private User currentUser = new User { Name = "John" };
}

@* ChildComponent.razor *@
<p>Current user: @User.Name</p>

@code {
    [CascadingParameter]
    public User User { get; set; } = default!;
}
```

### State Container Pattern

```csharp
// ✅ GOOD: AppState service
public class AppState
{
    private User? _currentUser;
    
    public User? CurrentUser
    {
        get => _currentUser;
        set
        {
            _currentUser = value;
            NotifyStateChanged();
        }
    }
    
    public event Action? OnChange;
    
    private void NotifyStateChanged() => OnChange?.Invoke();
}

// Register in Program.cs
builder.Services.AddScoped<AppState>();
```

```razor
@* Component using AppState *@
@inject AppState AppState
@implements IDisposable

<p>Current user: @AppState.CurrentUser?.Name</p>

@code {
    protected override void OnInitialized()
    {
        AppState.OnChange += StateHasChanged;
    }
    
    public void Dispose()
    {
        AppState.OnChange -= StateHasChanged;
    }
}
```

---

## Error Handling

```razor
@* ✅ GOOD: Error boundary *@
<ErrorBoundary>
    <ChildContent>
        <RiskyComponent />
    </ChildContent>
    <ErrorContent Context="exception">
        <div class="alert alert-danger">
            <p>An error occurred: @exception.Message</p>
            <button @onclick="@(() => exception.Recover())">Retry</button>
        </div>
    </ErrorContent>
</ErrorBoundary>

@* ✅ GOOD: Try-catch in component *@
@code {
    private string? errorMessage;
    
    private async Task SaveDataAsync()
    {
        try
        {
            await DataService.SaveAsync(data);
            errorMessage = null;
        }
        catch (Exception ex)
        {
            errorMessage = $"Failed to save: {ex.Message}";
            Logger.LogError(ex, "Error saving data");
        }
    }
}
```

---

## Performance Optimization

```razor
@* ✅ GOOD: ShouldRender optimization *@
@code {
    protected override bool ShouldRender()
    {
        // Only re-render if data has changed
        return dataHasChanged;
    }
}

@* ✅ GOOD: Virtualization for large lists *@
@using Microsoft.AspNetCore.Components.Web.Virtualization

<Virtualize Items="@largeList" Context="item">
    <div>@item.Name</div>
</Virtualize>

@* ✅ GOOD: Lazy loading *@
@code {
    private async Task<ItemsProviderResult<User>> LoadUsers(ItemsProviderRequest request)
    {
        var users = await UserService.GetUsersAsync(
            request.StartIndex, 
            request.Count, 
            request.CancellationToken);
        
        return new ItemsProviderResult<User>(users, totalCount);
    }
}

<Virtualize ItemsProvider="LoadUsers" Context="user">
    <UserCard User="@user" />
</Virtualize>
```

---

## Testing

```csharp
// ✅ GOOD: bUnit testing
using Bunit;
using Xunit;

public class CounterTests : TestContext
{
    [Fact]
    public void Counter_Increments_On_Button_Click()
    {
        // Arrange
        var cut = RenderComponent<Counter>();
        
        // Act
        cut.Find("button").Click();
        
        // Assert
        cut.Find("p").TextContent.Should().Contain("Current count: 1");
    }
    
    [Fact]
    public async Task UserProfile_Loads_User_Data()
    {
        // Arrange
        var mockUserService = new Mock<IUserService>();
        mockUserService
            .Setup(s => s.GetUserByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new User { Name = "John", Email = "john@example.com" });
        
        Services.AddSingleton(mockUserService.Object);
        
        // Act
        var cut = RenderComponent<UserProfile>(parameters => 
            parameters.Add(p => p.UserId, 1));
        
        // Assert
        await cut.WaitForState(() => cut.Find("h1").TextContent == "John");
    }
}
```

---

## Common Patterns

### Modal Dialog

```razor
@* Modal.razor *@
@if (IsVisible)
{
    <div class="modal-backdrop">
        <div class="modal-content">
            <h3>@Title</h3>
            @ChildContent
            <button @onclick="Close">Close</button>
        </div>
    </div>
}

@code {
    [Parameter]
    public bool IsVisible { get; set; }
    
    [Parameter]
    public string Title { get; set; } = "Modal";
    
    [Parameter]
    public RenderFragment? ChildContent { get; set; }
    
    [Parameter]
    public EventCallback OnClose { get; set; }
    
    private async Task Close()
    {
        await OnClose.InvokeAsync();
    }
}
```

---

## Common Pitfalls

| Issue | Problem | Solution |
|-------|---------|----------|
| **Missing @bind** | One-way binding only | Use `@bind="property"` for two-way |
| **StateHasChanged not called** | UI doesn't update | Call `StateHasChanged()` after async operations |
| **Memory leaks** | Event handlers not removed | Implement `IDisposable` and unsubscribe |
| **Wrong lifecycle method** | Code runs at wrong time | Use `OnInitializedAsync` for async init |
| **Scoped service in Singleton** | Service lifetime mismatch | Match service lifetimes properly |
| **Missing [Parameter]** | Parameters not working | Add `[Parameter]` attribute |

---

## Resources

- **Blazor Docs**: [learn.microsoft.com/aspnet/core/blazor](https://learn.microsoft.com/aspnet/core/blazor)
- **bUnit Testing**: [bunit.dev](https://bunit.dev)
- **Blazor WebAssembly**: [learn.microsoft.com](https://learn.microsoft.com/aspnet/core/blazor/hosting-models)
- **Awesome Blazor**: [github.com/AdrienTorris/awesome-blazor](https://github.com/AdrienTorris/awesome-blazor)
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026
