---
description: 'TypeScript and Node.js backend specific coding instructions for server-side development.'
applyTo: '**.ts'
---

# TypeScript / Node.js Backend Instructions

> **Note**: For React/TSX frontend code, see `react.instructions.md` which applies to `**.tsx` and `**.jsx` files.

## Code Style

- Enable strict mode in `tsconfig.json` (`"strict": true`)
- Use ESM imports (`import`/`export`), not CommonJS (`require`)
- Maximum line length: 100 characters (Prettier)
- Use `biome` or `eslint` + `prettier` for linting and formatting

## Type Safety

```typescript
// [PASS] Strict typing - no `any`
interface CreateUserRequest {
 readonly email: string;
 readonly name: string;
 readonly role: "admin" | "user" | "viewer";
}

// [PASS] Use branded types for domain IDs
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

// [PASS] Use discriminated unions for state machines
type RequestState =
 | { status: "idle" }
 | { status: "loading" }
 | { status: "success"; data: Response }
 | { status: "error"; error: Error };
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Interface | PascalCase | `UserService` |
| Type alias | PascalCase | `CreateUserRequest` |
| Function | camelCase | `getUserById` |
| Variable | camelCase | `userCount` |
| Constant | UPPER_SNAKE | `MAX_RETRIES` |
| Enum | PascalCase | `HttpStatus.Ok` |
| File | kebab-case | `user-service.ts` |

## Error Handling

```typescript
// [PASS] Use custom error classes
class AppError extends Error {
 constructor(
 message: string,
 public readonly statusCode: number,
 public readonly code: string,
 ) {
 super(message);
 this.name = "AppError";
 }
}

class NotFoundError extends AppError {
 constructor(resource: string, id: string) {
 super(`${resource} with id ${id} not found`, 404, "NOT_FOUND");
 }
}

// [PASS] Catch specific errors, log and re-throw
try {
 const user = await userService.getById(id);
} catch (error) {
 if (error instanceof NotFoundError) {
 logger.warn({ error, id }, "User not found");
 return res.status(404).json({ error: error.message });
 }
 logger.error({ error }, "Unexpected error fetching user");
 throw error; // Don't swallow unknown errors
}
```

## Async/Await

```typescript
// [PASS] Always use async/await over raw Promises
async function fetchUsers(ids: string[]): Promise<User[]> {
 const results = await Promise.allSettled(
 ids.map((id) => userRepository.findById(id)),
 );

 return results
 .filter((r): r is PromiseFulfilledResult<User> => r.status === "fulfilled")
 .map((r) => r.value);
}

// [PASS] Use AbortController for timeouts
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), timeoutMs);

 try {
 return await fetch(url, { signal: controller.signal });
 } finally {
 clearTimeout(timeout);
 }
}
```

## Project Structure (Backend)

```
src/
+-- routes/ # Route definitions (Express/Fastify/Hono)
+-- controllers/ # Request handling (thin - delegates to services)
+-- services/ # Business logic
+-- repositories/ # Data access layer
+-- middleware/ # Auth, logging, error handling
+-- types/ # Shared TypeScript types/interfaces
+-- utils/ # Pure utility functions
+-- config/ # Environment and app configuration
-- index.ts # Application entry point
```

## Dependency Injection

```typescript
// [PASS] Constructor injection with interfaces
interface UserRepository {
 findById(id: string): Promise<User | null>;
 create(data: CreateUserRequest): Promise<User>;
}

class UserService {
 constructor(
 private readonly userRepo: UserRepository,
 private readonly logger: Logger,
 ) {}

 async getById(id: string): Promise<User> {
 const user = await this.userRepo.findById(id);
 if (!user) throw new NotFoundError("User", id);
 return user;
 }
}
```

## Environment Configuration

```typescript
// [PASS] Validate env at startup, fail fast
import { z } from "zod";

const envSchema = z.object({
 NODE_ENV: z.enum(["development", "production", "test"]),
 PORT: z.coerce.number().default(3000),
 DATABASE_URL: z.string().url(),
 API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

## Testing

- Use **Vitest** (preferred) or Jest for unit/integration tests
- Use **Supertest** for HTTP endpoint testing
- Name tests: `describe("UserService")` -> `it("should return user by id")`
- Mock external dependencies, never call live APIs in tests

```typescript
import { describe, it, expect, vi } from "vitest";

describe("UserService", () => {
 it("should return user by id", async () => {
 const mockRepo: UserRepository = {
 findById: vi.fn().mockResolvedValue({ id: "1", name: "Test" }),
 create: vi.fn(),
 };

 const service = new UserService(mockRepo, mockLogger);
 const user = await service.getById("1");

 expect(user.name).toBe("Test");
 expect(mockRepo.findById).toHaveBeenCalledWith("1");
 });

 it("should throw NotFoundError when user missing", async () => {
 const mockRepo: UserRepository = {
 findById: vi.fn().mockResolvedValue(null),
 create: vi.fn(),
 };

 const service = new UserService(mockRepo, mockLogger);

 await expect(service.getById("999")).rejects.toThrow(NotFoundError);
 });
});
```

## Security

- Validate all inputs with `zod` schemas at the boundary (routes/controllers)
- Use `helmet` middleware for HTTP security headers
- Use `cors` with explicit origin allowlists (never `*` in production)
- Rate limit API endpoints (`express-rate-limit` or framework equivalent)
- Never log sensitive data (passwords, tokens, PII)
