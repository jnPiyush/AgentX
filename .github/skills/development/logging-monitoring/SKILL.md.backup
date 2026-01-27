---
name: logging-monitoring
description: 'Implement production observability with Serilog structured logging, OpenTelemetry tracing, Prometheus metrics, and alerting strategies.'
---

# Logging & Monitoring

> **Purpose**: Implement comprehensive logging and monitoring for production systems.

---

## Structured Logging with Serilog

```csharp
using Serilog;
using Serilog.Formatting.Json;
using System;

// Configure Serilog with JSON formatting
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithThreadId()
    .WriteTo.Console(new JsonFormatter())
    .WriteTo.File(
        new JsonFormatter(),
        "logs/app-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30)
    .CreateLogger();

// Usage with structured properties
Log.Information("User {UserId} logged in from {IpAddress}", userId, ipAddress);
Log.Warning("High memory usage: {MemoryUsageMB} MB", memoryUsage);
Log.Error(exception, "Failed to process order {OrderId}", orderId);

// Always flush and close on app shutdown
Log.CloseAndFlush();
```

---

## Microsoft.Extensions.Logging

```csharp
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

// Configure in Program.cs or Startup.cs
public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        
        // Configure logging
        builder.Logging.ClearProviders();
        builder.Logging.AddConsole();
        builder.Logging.AddDebug();
        builder.Logging.AddEventSourceLogger();
        
        // Add Serilog
        builder.Host.UseSerilog((context, configuration) =>
            configuration.ReadFrom.Configuration(context.Configuration));
        
        var app = builder.Build();
        app.Run();
    }
}

// Usage in classes via dependency injection
public class OrderService
{
    private readonly ILogger<OrderService> _logger;
    
    public OrderService(ILogger<OrderService> logger)
    {
        _logger = logger;
    }
    
    public async Task<Order> ProcessOrderAsync(int orderId)
    {
        _logger.LogInformation("Processing order {OrderId}", orderId);
        
        try
        {
            var order = await GetOrderAsync(orderId);
            _logger.LogDebug("Order details: {@Order}", order);
            return order;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process order {OrderId}", orderId);
            throw;
        }
    }
}
```

---

## Log Levels

```csharp
// Trace: Very detailed, typically only for debugging
_logger.LogTrace("Entering method ProcessOrder with {OrderId}", orderId);

// Debug: Detailed information for debugging
_logger.LogDebug("Order validation passed for {OrderId}", orderId);

// Information: General informational messages
_logger.LogInformation("Order {OrderId} processed successfully", orderId);

// Warning: Something unexpected but not an error
_logger.LogWarning("Order {OrderId} processing took longer than expected: {Duration}ms", orderId, duration);

// Error: Error occurred, operation failed
_logger.LogError(exception, "Failed to process order {OrderId}", orderId);

// Critical: Serious error, application may crash
_logger.LogCritical(exception, "Database connection lost");
```

---

## Configuration (appsettings.json)

```json
{
  "Serilog": {
    "Using": ["Serilog.Sinks.Console", "Serilog.Sinks.File"],
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning",
        "Microsoft.EntityFrameworkCore": "Information"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "formatter": "Serilog.Formatting.Json.JsonFormatter, Serilog"
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "logs/app-.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 30,
          "formatter": "Serilog.Formatting.Json.JsonFormatter, Serilog"
        }
      }
    ],
    "Enrich": ["FromLogContext", "WithMachineName", "WithThreadId"]
  }
}
```

---

## Metrics with prometheus-net

```csharp
using Prometheus;
using Microsoft.AspNetCore.Builder;

// Define metrics
public class Metrics
{
    public static readonly Counter RequestCount = Prometheus.Metrics
        .CreateCounter(
            "http_requests_total",
            "Total HTTP requests",
            new CounterConfiguration
            {
                LabelNames = new[] { "method", "endpoint", "status" }
            });
    
    public static readonly Histogram RequestDuration = Prometheus.Metrics
        .CreateHistogram(
            "http_request_duration_seconds",
            "HTTP request duration in seconds",
            new HistogramConfiguration
            {
                LabelNames = new[] { "method", "endpoint" },
                Buckets = Histogram.ExponentialBuckets(0.001, 2, 10)
            });
    
    public static readonly Gauge ActiveUsers = Prometheus.Metrics
        .CreateGauge(
            "active_users",
            "Number of active users");
}

// Configure in Program.cs
var app = builder.Build();

// Enable metrics endpoint
app.UseMetricServer();  // Exposes /metrics endpoint
app.UseHttpMetrics();   // Automatic HTTP metrics

// Usage in middleware
public class MetricsMiddleware
{
    private readonly RequestDelegate _next;
    
    public MetricsMiddleware(RequestDelegate next)
    {
        _next = next;
    }
    
    public async Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;
        var endpoint = context.Request.Path;
        
        using (Metrics.RequestDuration
            .WithLabels(method, endpoint)
            .NewTimer())
        {
            await _next(context);
            
            var status = context.Response.StatusCode.ToString();
            Metrics.RequestCount
                .WithLabels(method, endpoint, status)
                .Inc();
        }
    }
}

// Manual metric tracking
public class UserService
{
    public async Task LoginAsync(User user)
    {
        await PerformLoginAsync(user);
        Metrics.ActiveUsers.Inc();
    }
    
    public async Task LogoutAsync(User user)
    {
        await PerformLogoutAsync(user);
        Metrics.ActiveUsers.Dec();
    }
}
```

---

## Distributed Tracing with OpenTelemetry

```csharp
using OpenTelemetry;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using System.Diagnostics;

// Configure in Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenTelemetry()
    .WithTracing(tracerProviderBuilder =>
    {
        tracerProviderBuilder
            .AddSource("MyCompany.MyService")
            .SetResourceBuilder(
                ResourceBuilder.CreateDefault()
                    .AddService("MyService", serviceVersion: "1.0.0"))
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddEntityFrameworkCoreInstrumentation()
            .AddConsoleExporter()
            .AddJaegerExporter(options =>
            {
                options.AgentHost = "localhost";
                options.AgentPort = 6831;
            });
    });

// Usage in services
public class OrderService
{
    private static readonly ActivitySource ActivitySource = 
        new ActivitySource("MyCompany.MyService");
    
    public async Task ProcessOrderAsync(int orderId)
    {
        using var activity = ActivitySource.StartActivity("ProcessOrder");
        activity?.SetTag("order.id", orderId);
        
        try
        {
            // Process order with nested spans
            await ValidatePaymentAsync(orderId);
            await UpdateInventoryAsync(orderId);
            
            activity?.SetStatus(ActivityStatusCode.Ok);
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.RecordException(ex);
            throw;
        }
    }
    
    private async Task ValidatePaymentAsync(int orderId)
    {
        using var activity = ActivitySource.StartActivity("ValidatePayment");
        activity?.SetTag("order.id", orderId);
        
        // Validation logic
        await Task.Delay(100);
    }
    
    private async Task UpdateInventoryAsync(int orderId)
    {
        using var activity = ActivitySource.StartActivity("UpdateInventory");
        activity?.SetTag("order.id", orderId);
        
        // Update logic
        await Task.Delay(50);
    }
}
```

---

## Health Checks

```csharp
using Microsoft.Extensions.Diagnostics.HealthChecks;

// Configure in Program.cs
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy())
    .AddNpgSql(
        connectionString: builder.Configuration.GetConnectionString("DefaultConnection"),
        name: "database",
        tags: new[] { "db", "postgres" })
    .AddRedis(
        redisConnectionString: builder.Configuration.GetConnectionString("Redis"),
        name: "redis-cache",
        tags: new[] { "cache", "redis" })
    .AddUrlGroup(
        new Uri("https://api.external.com/health"),
        name: "external-api",
        tags: new[] { "external" });

var app = builder.Build();

// Map health check endpoints
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("db") || check.Tags.Contains("cache")
});
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // Just checks if app is running
});

// Custom health check
public class CustomHealthCheck : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Perform health check logic
            var isHealthy = await PerformCheckAsync(cancellationToken);
            
            return isHealthy
                ? HealthCheckResult.Healthy("Service is healthy")
                : HealthCheckResult.Unhealthy("Service is unhealthy");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy(
                "An error occurred during health check",
                ex);
        }
    }
    
    private async Task<bool> PerformCheckAsync(CancellationToken cancellationToken)
    {
        // Implement check
        await Task.Delay(10, cancellationToken);
        return true;
    }
}
```

---

## Application Performance Monitoring (APM)

### Supported Tools:
- **Application Insights** (Azure)
- **Datadog**
- **New Relic**
- **Elastic APM**
- **Dynatrace**
- **Prometheus + Grafana**

### Application Insights Configuration

```csharp
// Install: Microsoft.ApplicationInsights.AspNetCore

// Configure in Program.cs
builder.Services.AddApplicationInsightsTelemetry(options =>
{
    options.ConnectionString = builder.Configuration["ApplicationInsights:ConnectionString"];
});

// appsettings.json
{
  "ApplicationInsights": {
    "ConnectionString": "InstrumentationKey=your-key;IngestionEndpoint=https://..."
  }
}
```

---

## Best Practices

- **Log at appropriate levels**: Trace/Debug for development, Info+ for production
- **Include context**: Always log user_id, request_id, correlation_id
- **Use structured logging**: JSON format with typed properties
- **Monitor key metrics**: Request rate, duration, error rate, resource usage
- **Set up alerting**: Define thresholds and notification channels
- **Implement distributed tracing**: Track requests across microservices
- **Create dashboards**: Visualize metrics in Grafana/Application Insights
- **Implement health checks**: For Kubernetes liveness/readiness probes
- **Log correlation IDs**: Track requests across services
- **Redact sensitive data**: Never log passwords, tokens, PII
- **Use async logging**: Don't block application threads
- **Set retention policies**: Balance storage costs with compliance needs

---

## Required NuGet Packages

```bash
# Serilog
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
dotnet add package Serilog.Formatting.Json

# Prometheus
dotnet add package prometheus-net
dotnet add package prometheus-net.AspNetCore

# OpenTelemetry
dotnet add package OpenTelemetry
dotnet add package OpenTelemetry.Extensions.Hosting
dotnet add package OpenTelemetry.Instrumentation.AspNetCore
dotnet add package OpenTelemetry.Instrumentation.Http
dotnet add package OpenTelemetry.Exporter.Console
dotnet add package OpenTelemetry.Exporter.Jaeger

# Health Checks
dotnet add package Microsoft.Extensions.Diagnostics.HealthChecks
dotnet add package AspNetCore.HealthChecks.NpgSql
dotnet add package AspNetCore.HealthChecks.Redis

# Application Insights
dotnet add package Microsoft.ApplicationInsights.AspNetCore
```

---

**Related Skills**:
- [Error Handling](03-error-handling.md)
- [Performance](05-performance.md)
- [Scalability](07-scalability.md)

