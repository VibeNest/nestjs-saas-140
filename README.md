# NestJS SaaS Starter Kit

Production-ready NestJS API boilerplate for SaaS products. Includes JWT auth with refresh tokens, RBAC, Stripe subscriptions, email (Nodemailer), Prisma + PostgreSQL, Swagger docs, Docker, and Jest tests.

## Quick Start

The only setup step is copying the environment file:

```bash
cp .env.example .env
docker compose up -d postgres mailhog
npm install
npm run db:setup
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs
- Mailhog UI: http://localhost:8025

**Seeded admin:** `admin@example.com` / `Admin123!`

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Database | PostgreSQL 16 + Prisma |
| Auth | JWT + refresh tokens, OAuth (Google/GitHub) |
| Billing | Stripe Checkout + Customer Portal |
| Email | Nodemailer + Handlebars templates |
| Docs | Swagger/OpenAPI |
| Tests | Jest (unit + e2e) |
| DevOps | Docker Compose |

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Production build |
| `npm run db:setup` | Migrate + seed database |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests (auto-creates `.env.test`) |
| `npm run test:cov` | Coverage report |
| `npm run db:studio` | Open Prisma Studio |

## Environment Variables

All variables are documented in [`.env.example`](.env.example). Copy it to `.env` — every value is pre-filled for local development.

Key groups:

- **App:** `PORT`, `API_PREFIX`, `APP_URL`, `FRONTEND_URL`, `CORS_ORIGINS`
- **Database:** `DATABASE_URL`
- **JWT:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OAUTH_EXCHANGE_SECRET`, `REFRESH_TOKEN_DELIVERY`
- **Auth:** `REQUIRE_EMAIL_VERIFICATION` (set `true` in production)
- **Email:** `EMAIL_ENABLED`, `SMTP_*`, `EMAIL_FROM`
- **OAuth:** `GOOGLE_OAUTH_ENABLED`, `GITHUB_OAUTH_ENABLED` + client credentials
- **Stripe:** `STRIPE_ENABLED=false` by default until real keys are added

## Project Structure

```
src/
├── auth/           # Register, login, JWT, OAuth, password reset
├── users/          # Profile + admin user management
├── subscriptions/  # Plans, Stripe checkout, webhooks
├── email/          # Nodemailer + Handlebars templates
├── common/         # Guards, decorators, filters
├── config/         # Typed configuration + Joi validation
├── prisma/         # Prisma service
└── health/         # Health check endpoint
```

## API Overview

### Auth (`/auth`)
- `POST /register` — Create account + send verification email
- `POST /login` — Get access + refresh tokens
- `POST /refresh` — Rotate refresh token
- `POST /logout` — Revoke refresh token
- `GET /verify-email?token=` — Verify email
- `POST /forgot-password` / `POST /reset-password`
- `POST /oauth/exchange` — Exchange OAuth callback code for tokens
- `GET /google`, `GET /github` — OAuth (when enabled)

### Users (`/users`)
- `GET /me`, `PATCH /me` — Current user profile
- `GET /`, `PATCH /:id/role`, `PATCH /:id/status` — Admin only

### Subscriptions (`/subscriptions`)
- `GET /plans` — Public plan list
- `GET /me` — Current subscription
- `POST /checkout` — Stripe Checkout session
- `POST /portal` — Stripe Customer Portal

### Webhooks (`/webhooks`)
- `POST /stripe` — Stripe webhook handler

## Roles

| Role | Permissions |
|---|---|
| `USER` | Own profile, subscriptions |
| `ADMIN` | User management, role changes |
| `SUPER_ADMIN` | Full access including SUPER_ADMIN assignment |

## Customization

- **Roles:** Extend `Role` enum in `prisma/schema.prisma`
- **Plans:** Edit `prisma/seed.ts` + Stripe Dashboard prices
- **Email templates:** Replace `.hbs` files in `src/email/templates/`
- **OAuth:** Set `*_OAUTH_ENABLED=true` and add credentials to `.env`
- **Feature flags:** Disable Stripe/email/OAuth via `*_ENABLED` env vars

## Documentation

- [Auth Guide](docs/AUTH.md)
- [Stripe Setup](docs/STRIPE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)

## Docker Full Stack

```bash
cp .env.example .env
# Optional: merge docker overrides from .env.docker.example
docker compose --profile full up -d
```

The `api` service automatically uses `postgres` and `mailhog` hostnames. Set `RUN_SEED=true` on first deploy to create the admin user.

## Testing

```bash
docker compose up -d postgres
npm test
npm run test:e2e
```

See [docs/TESTING.md](docs/TESTING.md) for details.

## License

MIT
