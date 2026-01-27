---
name: api-design
description: 'Design robust REST APIs with proper versioning, pagination, error handling, rate limiting, and OpenAPI documentation.'
---

# API Design

> **Purpose**: Design robust, maintainable, and user-friendly APIs.

---

## RESTful Conventions

### Resource Naming

```
✅ Good:
GET    /api/v1/users              # List users
POST   /api/v1/users              # Create user
GET    /api/v1/users/{id}         # Get specific user
PUT    /api/v1/users/{id}         # Update user (full)
PATCH  /api/v1/users/{id}         # Update user (partial)
DELETE /api/v1/users/{id}         # Delete user

GET    /api/v1/users/{id}/orders  # Get user's orders (nested)
POST   /api/v1/users/{id}/orders  # Create order for user

❌ Bad:
GET    /api/v1/get_users
POST   /api/v1/create_user
GET    /api/v1/user_detail?id=123
```

---

## HTTP Status Codes

```csharp
// Success
200 OK                  // Successful GET, PUT, PATCH, DELETE
201 Created             // Successful POST
204 No Content          // Successful DELETE (no response body)

// Client Errors
400 Bad Request         // Invalid request syntax
401 Unauthorized        // Authentication required
403 Forbidden           // Authenticated but insufficient permissions
404 Not Found           // Resource doesn't exist
409 Conflict            // Resource conflict (e.g., duplicate email)
422 Unprocessable       // Validation error
429 Too Many Requests   // Rate limit exceeded

// Server Errors
500 Internal Server Error
503 Service Unavailable
```

---

## Response Format

### Success Response

```json
{
  "status": "success",
  "data": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe"
  },
  "metadata": {
    "timestamp": "2026-01-06T12:00:00Z",
    "version": "1.0.0"
  }
}
```

### Error Response

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "metadata": {
    "timestamp": "2026-01-06T12:00:00Z",
    "request_id": "abc-123"
  }
}
```

### Response Models

```csharp
// Standard response wrapper
public class ApiResponse<T>
{
    public string Status { get; set; } = "success";
    public T? Data { get; set; }
    public ResponseMetadata Metadata { get; set; } = new();
}

public class ApiErrorResponse
{
    public string Status { get; set; } = "error";
    public ErrorDetails Error { get; set; } = new();
    public ResponseMetadata Metadata { get; set; } = new();
}

public class ResponseMetadata
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Version { get; set; } = "1.0.0";
    public string? RequestId { get; set; }
}

public class ErrorDetails
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public List<ValidationError>? Details { get; set; }
}

public class ValidationError
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
```

---

## Pagination

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

// Pagination request model
public class PaginationRequest
{
    public int Page { get; set; } = 1;
    
    private int _perPage = 20;
    public int PerPage
    {
        get => _perPage;
        set => _perPage = Math.Min(value, 100); // Max 100 items per page
    }
}

// Pagination response model
public class PaginatedResponse<T>
{
    public List<T> Data { get; set; } = new();
    public PaginationMetadata Pagination { get; set; } = new();
}

public class PaginationMetadata
{
    public int Page { get; set; }
    public int PerPage { get; set; }
    public int Total { get; set; }
    public int Pages { get; set; }
    public bool HasNext { get; set; }
    public bool HasPrev { get; set; }
}

// Controller implementation
[ApiController]
[Route("api/v1/[controller]")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    
    public UsersController(ApplicationDbContext context)
    {
        _context = context;
    }
    
    /// <summary>
    /// List users with pagination
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResponse<UserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListUsers([FromQuery] PaginationRequest request)
    {
        var query = _context.Users.AsQueryable();
        
        var total = await query.CountAsync();
        var pages = (int)Math.Ceiling(total / (double)request.PerPage);
        
        var users = await query
            .Skip((request.Page - 1) * request.PerPage)
            .Take(request.PerPage)
            .Select(u => new UserDto
            {
                Id = u.Id,
                Email = u.Email,
                Name = u.Name
            })
            .ToListAsync();
        
        var response = new PaginatedResponse<UserDto>
        {
            Data = users,
            Pagination = new PaginationMetadata
            {
                Page = request.Page,
                PerPage = request.PerPage,
                Total = total,
                Pages = pages,
                HasNext = request.Page < pages,
                HasPrev = request.Page > 1
            }
        };
        
        return Ok(response);
    }
}
```

---

## Rate Limiting

```csharp
using AspNetCoreRateLimit;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

// Configure in Program.cs or Startup.cs
public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        
        // Add memory cache for rate limiting
        builder.Services.AddMemoryCache();
        
        // Configure rate limiting
        builder.Services.Configure<IpRateLimitOptions>(options =>
        {
            options.GeneralRules = new List<RateLimitRule>
            {
                new RateLimitRule
                {
                    Endpoint = "*",
                    Period = "1m",
                    Limit = 60
                },
                new RateLimitRule
                {
                    Endpoint = "*/api/search",
                    Period = "1m",
                    Limit = 10
                }
            };
        });
        
        builder.Services.AddInMemoryRateLimiting();
        builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
        
        var app = builder.Build();
        
        // Use rate limiting middleware
        app.UseIpRateLimiting();
        
        app.MapControllers();
        app.Run();
    }
}

// Alternative: Custom rate limiting with .NET 7+ built-in support
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.Identity?.Name ?? context.Request.Headers.Host.ToString(),
            factory: partition => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1)
            }));
});

// Apply to specific endpoint
[ApiController]
[Route("api/v1/[controller]")]
public class SearchController : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("fixed")]
    public async Task<IActionResult> Search([FromQuery] string query)
    {
        // Search implementation
        return Ok(results);
    }
}
```

---

## Versioning

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Versioning;

// Configure versioning in Program.cs
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    
    // URL versioning
    options.ApiVersionReader = new UrlSegmentApiVersionReader();
    
    // Or header versioning
    // options.ApiVersionReader = new HeaderApiVersionReader("X-API-Version");
    
    // Or query string versioning
    // options.ApiVersionReader = new QueryStringApiVersionReader("version");
});

// URL versioning - Version 1
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class UsersV1Controller : ControllerBase
{
    [HttpGet]
    public IActionResult GetUsers()
    {
        return Ok(new { version = "1.0", users = new[] { "user1", "user2" } });
    }
}

// URL versioning - Version 2
[ApiController]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class UsersV2Controller : ControllerBase
{
    [HttpGet]
    public IActionResult GetUsers()
    {
        return Ok(new
        {
            version = "2.0",
            users = new[]
            {
                new { id = 1, name = "user1" },
                new { id = 2, name = "user2" }
            }
        });
    }
}

// Header versioning example
[ApiController]
[ApiVersion("1.0")]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet]
    [MapToApiVersion("1.0")]
    public IActionResult GetV1()
    {
        return Ok(new { version = "1.0" });
    }
    
    [HttpGet]
    [MapToApiVersion("2.0")]
    public IActionResult GetV2()
    {
        return Ok(new { version = "2.0" });
    }
}
```

---

## Request Validation

```csharp
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;

// DTO with validation attributes
public class CreateUserRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public string Email { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Name is required")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 100 characters")]
    public string Name { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Password is required")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]",
        ErrorMessage = "Password must contain uppercase, lowercase, number, and special character")]
    public string Password { get; set; } = string.Empty;
    
    [Range(18, 120, ErrorMessage = "Age must be between 18 and 120")]
    public int Age { get; set; }
}

// Controller with automatic validation
[ApiController]
[Route("api/v1/[controller]")]
public class UsersController : ControllerBase
{
    /// <summary>
    /// Create a new user
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        // ModelState is automatically validated by ASP.NET Core
        if (!ModelState.IsValid)
        {
            var errors = ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .SelectMany(x => x.Value!.Errors.Select(e => new ValidationError
                {
                    Field = x.Key,
                    Message = e.ErrorMessage
                }))
                .ToList();
            
            return UnprocessableEntity(new ApiErrorResponse
            {
                Error = new ErrorDetails
                {
                    Code = "VALIDATION_ERROR",
                    Message = "Invalid input data",
                    Details = errors
                }
            });
        }
        
        // Process valid request
        var user = await _userService.CreateUserAsync(request);
        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
    }
}

// Custom validation filter
public class ValidateModelAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.ModelState.IsValid)
        {
            var errors = context.ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .SelectMany(x => x.Value!.Errors.Select(e => new ValidationError
                {
                    Field = x.Key,
                    Message = e.ErrorMessage
                }))
                .ToList();
            
            context.Result = new UnprocessableEntityObjectResult(new ApiErrorResponse
            {
                Error = new ErrorDetails
                {
                    Code = "VALIDATION_ERROR",
                    Message = "Invalid input data",
                    Details = errors
                }
            });
        }
    }
}

// Apply globally in Program.cs
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidateModelAttribute>();
});
```

---

## API Documentation with Swagger

```csharp
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.Annotations;

// Configure Swagger in Program.cs
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My API",
        Version = "v1",
        Description = "API for managing users and products",
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
    
    // Add JWT authentication
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "My API V1");
        options.RoutePrefix = string.Empty; // Serve at root
    });
}

// Controller with XML documentation
[ApiController]
[Route("api/v1/[controller]")]
public class UsersController : ControllerBase
{
    /// <summary>
    /// Get a user by ID
    /// </summary>
    /// <param name="id">The user ID</param>
    /// <returns>The user details</returns>
    /// <response code="200">Returns the user</response>
    /// <response code="404">User not found</response>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUser(int id)
    {
        var user = await _userService.GetUserAsync(id);
        if (user == null)
            return NotFound();
        
        return Ok(user);
    }
}
```

---

**Related Skills**:
- [Code Organization](08-code-organization.md)
- [Security](04-security.md)

