# Blazor Component Parameters, Binding & Lifecycle

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

@* [PASS] GOOD: Form with validation *@
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
