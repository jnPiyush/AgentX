---
description: 'API design and controller instructions for backend development.'
applyTo: '**/Controllers/**, **/api/**, **/endpoints/**'
---

# API Design Instructions

## REST Conventions

| Operation | HTTP Method | URL Pattern | Response |
|-----------|-------------|-------------|----------|
| List | GET | `/users` | 200 + array |
| Get | GET | `/users/{id}` | 200 or 404 |
| Create | POST | `/users` | 201 + Location header |
| Update | PUT | `/users/{id}` | 200 or 204 |
| Partial Update | PATCH | `/users/{id}` | 200 or 204 |
| Delete | DELETE | `/users/{id}` | 204 or 404 |

## Controller Structure (ASP.NET Core)

```csharp
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
 private readonly IUserService _userService;
 private readonly ILogger<UsersController> _logger;

 public UsersController(IUserService userService, ILogger<UsersController> logger)
 {
 _userService = userService;
 _logger = logger;
 }

 /// <summary>
 /// Retrieves a user by ID.
 /// </summary>
 /// <param name="id">The user's unique identifier.</param>
 /// <response code="200">Returns the user.</response>
 /// <response code="404">User not found.</response>
 [HttpGet("{id:guid}")]
 [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
 [ProducesResponseType(StatusCodes.Status404NotFound)]
 public async Task<ActionResult<UserDto>> GetUser(Guid id)
 {
 var user = await _userService.GetByIdAsync(id);
 if (user is null)
 {
 return NotFound();
 }
 return Ok(user);
 }

 /// <summary>
 /// Creates a new user.
 /// </summary>
 [HttpPost]
 [ProducesResponseType(typeof(UserDto), StatusCodes.Status201Created)]
 [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
 public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserRequest request)
 {
 var user = await _userService.CreateAsync(request);
 return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
 }
}
```

## Error Responses

Use Problem Details (RFC 7807):

```json
{
 "type": "https://api.example.com/errors/validation",
 "title": "Validation Error",
 "status": 400,
 "detail": "One or more validation errors occurred.",
 "instance": "/api/users",
 "errors": {
 "email": ["Email is required", "Email format is invalid"]
 }
}
```

## Pagination

```csharp
[HttpGet]
public async Task<ActionResult<PagedResult<UserDto>>> GetUsers(
 [FromQuery] int page = 1,
 [FromQuery] int pageSize = 20)
{
 pageSize = Math.Clamp(pageSize, 1, 100);
 var result = await _userService.GetPagedAsync(page, pageSize);

 Response.Headers["X-Total-Count"] = result.TotalCount.ToString();
 Response.Headers["X-Page"] = page.ToString();
 Response.Headers["X-Page-Size"] = pageSize.ToString();

 return Ok(result);
}
```

## Versioning

```csharp
// URL versioning (recommended)
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
[ApiVersion("2.0")]
public class UsersController : ControllerBase
{
 [HttpGet]
 [MapToApiVersion("1.0")]
 public ActionResult<UserV1Dto> GetV1() { }

 [HttpGet]
 [MapToApiVersion("2.0")]
 public ActionResult<UserV2Dto> GetV2() { }
}
```

## Rate Limiting

```csharp
// Apply rate limiting
[EnableRateLimiting("api")]
[HttpPost]
public async Task<ActionResult> Create([FromBody] Request request)
```

## Security

- Always validate input with FluentValidation
- Use authorization attributes
- Never expose internal IDs in URLs if security-sensitive
- Log all API access with correlation IDs

