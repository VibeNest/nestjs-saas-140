# Testing Guide

## Prerequisites

```bash
cp .env.example .env
docker compose up -d postgres
```

E2e tests use a separate database (`nestjs_saas_test`) created automatically by Docker init script.

## Unit Tests

```bash
npm test
```

Unit tests mock external dependencies (database, SMTP, Stripe). They cover:

- `AuthService` — register, login, OAuth validation
- `UsersService` — profile, RBAC role changes
- `EmailService` — template rendering, enabled/disabled
- `SubscriptionsService` — plans, checkout
- `RolesGuard` — permission enforcement

### Watch Mode

```bash
npm run test:watch
```

### Coverage

```bash
npm run test:cov
```

Report output: `coverage/lcov-report/index.html`

## E2E Tests

```bash
npm run test:e2e
```

This command:
1. Creates `.env.test` from `.env.test.example` (if missing)
2. Runs migrations and seed on test database
3. Executes full HTTP tests against real PostgreSQL

E2E test files:

| File | Coverage |
|---|---|
| `test/health.e2e-spec.ts` | Health endpoint |
| `test/auth.e2e-spec.ts` | Register, login, refresh, logout, password reset |
| `test/users.e2e-spec.ts` | Profile, admin routes, RBAC |
| `test/subscriptions.e2e-spec.ts` | Plans, checkout errors, webhook rejection |

## Test Database

The test database URL is configured in `.env.test.example`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestjs_saas_test
```

Email is disabled in test env (`EMAIL_ENABLED=false`). Tokens are read directly from the database in e2e tests.

## Troubleshooting

**"Can't reach database server"**
- Ensure Docker postgres is running: `docker compose up -d postgres`
- Wait for health check: `docker compose ps`

**Migration errors**
- Reset test DB: `dotenv -e .env.test -- npx prisma migrate reset --force`

**Port conflicts**
- Change `PORT` in `.env.test` if 3001 is in use
