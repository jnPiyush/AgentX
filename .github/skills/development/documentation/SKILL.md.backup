---
name: documentation
description: 'Write clear documentation including XML docs, README files, API documentation with OpenAPI/Swagger, and inline code comments.'
---

# Documentation

> **Purpose**: Write clear, maintainable documentation for code and APIs.

---

## XML Documentation Comments

### C# XML Documentation

```csharp
/// <summary>
/// Calculate discounted price.
/// </summary>
/// <param name="price">Original price in dollars.</param>
/// <param name="discountPercent">Discount as decimal (0.1 for 10%).</param>
/// <returns>The discounted price.</returns>
/// <exception cref="ArgumentException">Thrown when price is negative.</exception>
/// <example>
/// <code>
/// decimal result = CalculateDiscount(100m, 0.1m);
/// // result = 90.0m
/// </code>
/// </example>
public decimal CalculateDiscount(decimal price, decimal discountPercent)
{
    if (price < 0)
    {
        throw new ArgumentException("Price cannot be negative", nameof(price));
    }
    return price * (1 - discountPercent);
}
```

### Class and Interface Documentation

```csharp
/// <summary>
/// Provides functionality for processing customer orders.
/// </summary>
/// <remarks>
/// This service handles order validation, processing, and notification.
/// All operations are thread-safe and support async execution.
/// </remarks>
public class OrderService : IOrderService
{
    /// <summary>
    /// Gets the order repository.
    /// </summary>
    private readonly IOrderRepository _orderRepository;
    
    /// <summary>
    /// Initializes a new instance of the <see cref="OrderService"/> class.
    /// </summary>
    /// <param name="orderRepository">The order repository.</param>
    /// <exception cref="ArgumentNullException">
    /// Thrown when <paramref name="orderRepository"/> is null.
    /// </exception>
    public OrderService(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
    }
}
```

### Enable XML Documentation Generation

Add to your `.csproj` file:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>$(NoWarn);1591</NoWarn>
  </PropertyGroup>
</Project>
```

---

## README Structure

```markdown
# Project Name

Brief description of the project

## Features
- Feature 1
- Feature 2

## Prerequisites

- .NET 8.0 SDK or later
- SQL Server 2019+

## Installation

\`\`\`bash
dotnet restore
dotnet build
\`\`\`

## Configuration

Create an \`appsettings.json\` file:

\`\`\`json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=mydb"
  }
}
\`\`\`

## Usage

\`\`\`csharp
using MyProject;

var service = new MyService();
await service.ProcessAsync();
\`\`\`

## Running Tests

\`\`\`bash
dotnet test
\`\`\`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT
```

---

## API Documentation

### Swagger/OpenAPI for ASP.NET Core

```csharp
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add Swagger services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My API",
        Version = "v1",
        Description = "API for managing resources",
        Contact = new OpenApiContact
        {
            Name = "Support Team",
            Email = "support@example.com"
        }
    });
    
    // Include XML comments
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    options.IncludeXmlComments(xmlPath);
});

var app = builder.Build();

// Enable Swagger middleware
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "My API V1");
        options.RoutePrefix = string.Empty; // Serve at root
    });
}

app.Run();
```

### Documented API Controller

```csharp
/// <summary>
/// Manages product operations.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ProductsController : ControllerBase
{
    /// <summary>
    /// Retrieves a product by ID.
    /// </summary>
    /// <param name="id">The product ID.</param>
    /// <returns>The product details.</returns>
    /// <response code="200">Returns the product.</response>
    /// <response code="404">Product not found.</response>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(Product), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Product>> GetProduct(int id)
    {
        var product = await _productService.GetByIdAsync(id);
        if (product == null)
        {
            return NotFound();
        }
        return Ok(product);
    }
}
```

---

## Documentation Tools

- **DocFX**: Generate documentation websites from XML comments and Markdown
- **Sandcastle**: Legacy documentation generator for .NET
- **Swagger/OpenAPI**: Interactive API documentation
- **NSwag**: Generate TypeScript/C# clients from OpenAPI specs
- **Postman**: API testing and documentation

### DocFX Setup

```bash
# Install DocFX
dotnet tool install -g docfx

# Initialize DocFX project
docfx init -q

# Build documentation
docfx docfx.json --serve
```

---

**Related Skills**:
- [Code Organization](08-code-organization.md)
- [API Design](09-api-design.md)

