# Blazor State Management, Performance & Testing

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
// [PASS] GOOD: AppState service
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
@* [PASS] GOOD: Error boundary *@
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

@* [PASS] GOOD: Try-catch in component *@
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
@* [PASS] GOOD: ShouldRender optimization *@
@code {
 protected override bool ShouldRender()
 {
 // Only re-render if data has changed
 return dataHasChanged;
 }
}

@* [PASS] GOOD: Virtualization for large lists *@
@using Microsoft.AspNetCore.Components.Web.Virtualization

<Virtualize Items="@largeList" Context="item">
 <div>@item.Name</div>
</Virtualize>

@* [PASS] GOOD: Lazy loading *@
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
// [PASS] GOOD: bUnit testing
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
