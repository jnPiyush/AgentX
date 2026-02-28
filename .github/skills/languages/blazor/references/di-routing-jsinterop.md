# Blazor DI, Routing & JavaScript Interop

## Dependency Injection

```csharp
// [PASS] GOOD: Register services in Program.cs
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
@* [PASS] GOOD: Inject services in components *@
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
@* [PASS] GOOD: Route with parameters *@
@page "/products/{ProductId:int}"
@page "/products/{ProductId:int}/{Variant}"

<h1>Product @ProductId - @Variant</h1>

@code {
 [Parameter]
 public int ProductId { get; set; }
 
 [Parameter]
 public string? Variant { get; set; }
}

@* [PASS] GOOD: Navigation *@
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
@* [PASS] GOOD: Call JavaScript from C# *@
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
