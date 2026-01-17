---
name: security
description: 'Production security practices covering OWASP Top 10, input validation, SQL injection prevention, authentication/authorization, and secrets management.'
---

# Security

> **Purpose**: Production security practices to protect against common vulnerabilities.  
> **Focus**: Input validation, SQL injection prevention, authentication, secrets management.

---

## OWASP Top 10 (2025)

1. **Broken Access Control** - Authorization failures
2. **Cryptographic Failures** - Weak encryption, exposed secrets
3. **Injection** - SQL, NoSQL, command injection
4. **Insecure Design** - Missing security controls
5. **Security Misconfiguration** - Default configs, unnecessary features
6. **Vulnerable Components** - Outdated dependencies
7. **Authentication Failures** - Weak passwords, session management
8. **Software/Data Integrity** - Unsigned updates, insecure CI/CD
9. **Logging/Monitoring Failures** - Missing audit logs
10. **Server-Side Request Forgery (SSRF)** - Unvalidated URLs

---

## Input Validation

### Always Validate & Sanitize

```csharp
using FluentValidation;

public class UserInputValidator : AbstractValidator<UserInput>
{
    public UserInputValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(255);
            
        RuleFor(x => x.Username)
            .NotEmpty()
            .Length(3, 20)
            .Matches(@"^[a-zA-Z0-9_]+$")
            .WithMessage("Username can only contain letters, numbers, and underscores");
            
        RuleFor(x => x.Age)
            .InclusiveBetween(13, 120);
    }
}

// Use in controller
public async Task<IActionResult> CreateUser([FromBody] UserInput input)
{
    var validator = new UserInputValidator();
    var result = await validator.ValidateAsync(input);
    
    if (!result.IsValid)
        return BadRequest(result.Errors);
    
    return Ok(await _service.CreateUserAsync(input));
}
```

### Sanitize HTML

```csharp
using Ganss.Xss;

public class HtmlSanitizer
{
    private readonly HtmlSanitizer _sanitizer;
    
    public HtmlSanitizer()
    {
        _sanitizer = new HtmlSanitizer();
        _sanitizer.AllowedTags.Clear();
        _sanitizer.AllowedTags.Add("p");
        _sanitizer.AllowedTags.Add("br");
        _sanitizer.AllowedTags.Add("strong");
        _sanitizer.AllowedTags.Add("em");
    }
    
    public string Sanitize(string html) => _sanitizer.Sanitize(html);
}
```

---

## SQL Injection Prevention

### Use Parameterized Queries

```csharp
// ❌ NEVER concatenate SQL
public async Task<User> GetUser(string email)
{
    var sql = $"SELECT * FROM Users WHERE Email = '{email}'"; // VULNERABLE!
    return await _db.QueryFirstAsync<User>(sql);
}

// ✅ Always use parameters
public async Task<User> GetUser(string email)
{
    var sql = "SELECT * FROM Users WHERE Email = @Email";
    return await _db.QueryFirstAsync<User>(sql, new { Email = email });
}

// ✅ EF Core (safe by default)
public async Task<User> GetUser(string email)
{
    return await _context.Users
        .FirstOrDefaultAsync(u => u.Email == email);
}
```

---

## Authentication & Authorization

### JWT Authentication

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]))
        };
    });

app.UseAuthentication();
app.UseAuthorization();
```

### Authorization Policies

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("CanEditUser", policy => 
        policy.RequireClaim("Permission", "EditUser"));
});

[Authorize(Policy = "AdminOnly")]
public IActionResult DeleteUser(int id)
{
    _service.DeleteUser(id);
    return NoContent();
}
```

### Password Hashing

```csharp
using BCrypt.Net;

public class PasswordService
{
    public string HashPassword(string password)
    {
        return BCrypt.HashPassword(password, workFactor: 12);
    }
    
    public bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Verify(password, hash);
    }
}

// ❌ Never store plain text passwords
user.Password = input.Password; // NEVER!

// ✅ Always hash passwords
user.PasswordHash = _passwordService.HashPassword(input.Password);
```

---

## Secrets Management

### Use Environment Variables

```csharp
// appsettings.json - NO SECRETS HERE
{
  "ConnectionStrings": {
    "Default": "Server=localhost;Database=MyApp;User Id=myapp;"
  }
}

// ✅ Use environment variables or Azure Key Vault
var connectionString = builder.Configuration.GetConnectionString("Default");
var password = Environment.GetEnvironmentVariable("DB_PASSWORD");
connectionString += $"Password={password}";
```

### Azure Key Vault

```csharp
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{keyVaultName}.vault.azure.net/"),
    new DefaultAzureCredential());

// Access secrets
var apiKey = builder.Configuration["ApiKey"]; // Retrieved from Key Vault
```

### User Secrets (Development Only)

```bash
# Initialize user secrets
dotnet user-secrets init

# Set secret
dotnet user-secrets set "ApiKey" "my-secret-key"
```

```csharp
// Access in development
var apiKey = builder.Configuration["ApiKey"];
```

---

## HTTPS & TLS

```csharp
// Force HTTPS in production
if (app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
    app.UseHsts();
}

// Configure HSTS
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});
```

---

## CORS

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Production", policy =>
    {
        policy.WithOrigins("https://myapp.com")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

app.UseCors("Production");

// ❌ Never use in production
// policy.AllowAnyOrigin() - DANGEROUS!
```

---

## Rate Limiting

```csharp
using AspNetCoreRateLimit;

builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(options =>
{
    options.GeneralRules = new List<RateLimitRule>
    {
        new RateLimitRule
        {
            Endpoint = "*",
            Limit = 100,
            Period = "1m"
        },
        new RateLimitRule
        {
            Endpoint = "*/api/login",
            Limit = 5,
            Period = "1m"
        }
    };
});

builder.Services.AddInMemoryRateLimiting();
app.UseIpRateLimiting();
```

---

## Security Headers

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Add("X-Frame-Options", "DENY");
    context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Add("Referrer-Policy", "no-referrer");
    context.Response.Headers.Add("Content-Security-Policy", 
        "default-src 'self'; script-src 'self'; style-src 'self'");
    await next();
});
```

---

## Best Practices

### ✅ DO

- **Validate all inputs** - Never trust user data
- **Parameterize SQL** - Use ORM or prepared statements
- **Hash passwords** - BCrypt with work factor ≥12
- **Use HTTPS** - Always in production
- **Store secrets securely** - Key Vault, env vars, never in code
- **Implement RBAC** - Role-based access control
- **Enable rate limiting** - Prevent abuse
- **Add security headers** - X-Content-Type-Options, CSP, etc.
- **Log security events** - Failed logins, access violations
- **Update dependencies** - Patch vulnerabilities regularly
- **Use least privilege** - Minimal necessary permissions

### ❌ DON'T

- **Trust user input** - Always validate/sanitize
- **Concatenate SQL** - Always use parameters
- **Store plain passwords** - Always hash
- **Hardcode secrets** - Use secure storage
- **Allow any CORS origin** - Whitelist specific domains
- **Ignore security warnings** - Fix them immediately
- **Use default credentials** - Change all defaults
- **Skip authentication** - Protect all sensitive endpoints
- **Expose error details** - Return generic errors to users
- **Disable SSL validation** - Never in production

---

## Security Checklist

- [ ] All inputs validated and sanitized
- [ ] SQL queries parameterized (no string concatenation)
- [ ] Passwords hashed with BCrypt/Argon2 (work factor ≥12)
- [ ] Secrets in Key Vault or environment variables
- [ ] HTTPS enforced in production
- [ ] CORS properly configured (no AllowAnyOrigin)
- [ ] Authentication implemented (JWT/OAuth)
- [ ] Authorization policies defined
- [ ] Rate limiting enabled
- [ ] Security headers added
- [ ] Error handling doesn't expose internals
- [ ] Logging includes security events
- [ ] Dependencies updated and audited
- [ ] Security scan passed (OWASP ZAP, Snyk)
- [ ] Penetration testing completed

---

## Resources

**OWASP**: [Top 10](https://owasp.org/www-project-top-ten/) • [Cheat Sheets](https://cheatsheetseries.owasp.org)  
**Tools**: [Snyk](https://snyk.io) • [OWASP ZAP](https://www.zaproxy.org) • [SonarQube](https://www.sonarqube.org)  
**.NET Security**: [Microsoft Docs](https://learn.microsoft.com/aspnet/core/security/)

---

**See Also**: [10-configuration.md](10-configuration.md) • [03-error-handling.md](03-error-handling.md)

**Last Updated**: January 13, 2026
