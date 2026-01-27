---
name: configuration
description: 'Manage application configuration with environment variables, Azure Key Vault, feature flags, and environment-specific settings.'
---

# Configuration Management

> **Purpose**: Manage application configuration across environments securely and efficiently.

---

## Configuration with IConfiguration

```csharp
using System;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public class AppConfig
{
    private readonly IConfiguration _configuration;
    
    public AppConfig(IConfiguration configuration)
    {
        _configuration = configuration;
    }
    
    // Required
    public string DatabaseUrl => _configuration["DatabaseUrl"] 
        ?? throw new InvalidOperationException("DatabaseUrl is required");
    public string SecretKey => _configuration["SecretKey"] 
        ?? throw new InvalidOperationException("SecretKey is required");
    
    // Optional with defaults
    public bool Debug => bool.Parse(_configuration["Debug"] ?? "false");
    public int Port => int.Parse(_configuration["Port"] ?? "8000");
    public string LogLevel => _configuration["LogLevel"] ?? "Information";
    
    // Environment-specific
    public string Environment => _configuration["Environment"] ?? "Development";
    public bool IsProduction => Environment.Equals("Production", StringComparison.OrdinalIgnoreCase);
}
```

### appsettings.json

```json
{
  "DatabaseUrl": "",
  "SecretKey": "",
  "Debug": false,
  "Port": 8000,
  "LogLevel": "Information",
  "Environment": "Development"
}
```

### Program.cs Setup

```csharp
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

builder.Configuration
    .AddJsonFile("appsettings.json", optional: false)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
    .AddEnvironmentVariables()
    .AddUserSecrets<Program>(optional: true);

builder.Services.AddSingleton<AppConfig>();
```

---

## Feature Flags

```csharp
public interface IFeatureFlags
{
    bool IsEnabled(string flagName);
}

public class FeatureFlags : IFeatureFlags
{
    private readonly IConfiguration _configuration;
    private readonly Dictionary<string, bool> _flags;
    
    public FeatureFlags(IConfiguration configuration)
    {
        _configuration = configuration;
        _flags = new Dictionary<string, bool>
        {
            ["NewUi"] = bool.Parse(_configuration["Features:NewUi"] ?? "false"),
            ["AiFeatures"] = bool.Parse(_configuration["Features:AiFeatures"] ?? "false")
        };
    }
    
    public bool IsEnabled(string flagName)
    {
        return _flags.TryGetValue(flagName, out var enabled) && enabled;
    }
}

// Usage
public class MyController
{
    private readonly IFeatureFlags _features;
    
    public MyController(IFeatureFlags features)
    {
        _features = features;
    }
    
    public IActionResult Index()
    {
        if (_features.IsEnabled("NewUi"))
        {
            return RenderNewUi();
        }
        else
        {
            return RenderLegacyUi();
        }
    }
}
```

---

## Secrets Management

```csharp
// ❌ Never hardcode secrets
public const string ApiKey = "sk_live_abc123";

// ✅ Use IConfiguration with environment variables
public class ApiService
{
    private readonly string _apiKey;
    
    public ApiService(IConfiguration configuration)
    {
        _apiKey = configuration["ApiKey"] 
            ?? throw new InvalidOperationException("ApiKey is required");
    }
}

// ✅ Use Azure Key Vault
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.Extensions.Configuration;

public static class KeyVaultExtensions
{
    public static IConfigurationBuilder AddAzureKeyVault(
        this IConfigurationBuilder builder, 
        string keyVaultUrl)
    {
        var secretClient = new SecretClient(
            new Uri(keyVaultUrl), 
            new DefaultAzureCredential());
            
        builder.AddAzureKeyVault(secretClient, new KeyVaultSecretManager());
        return builder;
    }
}

// Setup in Program.cs
builder.Configuration.AddAzureKeyVault(
    builder.Configuration["KeyVaultUrl"] ?? throw new InvalidOperationException("KeyVaultUrl required"));
```

### User Secrets (Development)

```bash
# Initialize user secrets
dotnet user-secrets init

# Set secrets
dotnet user-secrets set "ApiKey" "sk_dev_abc123"
dotnet user-secrets set "DatabaseUrl" "Server=localhost;Database=mydb"

# List secrets
dotnet user-secrets list
```

---

**Related Skills**:
- [Security](04-security.md)
- [Code Organization](08-code-organization.md)

