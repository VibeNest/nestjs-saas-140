# Deployment Guide

## Docker Production

Build and run the full stack:

```bash
cp .env.example .env
docker compose --profile full up -d
```

The API container overrides `DATABASE_URL` to use the `postgres` service hostname and `SMTP_HOST=mailhog`. On first run, `RUN_SEED=true` (default in compose) creates the admin user and plans.

For local development without the API container:

```bash
docker compose up -d postgres mailhog
npm run db:setup
npm run start:dev
```

See [`.env.docker.example`](../.env.docker.example) for Docker-specific overrides.

### API-only Docker Build

```bash
docker build -t nestjs-saas-api .
docker run -p 3000:3000 --env-file .env nestjs-saas-api
```

The container runs `prisma migrate deploy` before starting.

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (32+ chars)
- [ ] Configure real SMTP credentials (or transactional email provider)
- [ ] Set production `DATABASE_URL` with SSL
- [ ] Configure Stripe live keys and webhook secret
- [ ] Set `CORS_ORIGINS` to your frontend domain only
- [ ] Enable HTTPS (reverse proxy: nginx, Caddy, etc.)
- [ ] Change `BOOTSTRAP_ADMIN_PASSWORD` before first seed
- [ ] Set up database backups
- [ ] Configure health check monitoring on `GET /health`

## Database Migrations

Development:
```bash
npm run db:migrate
```

Production:
```bash
npx prisma migrate deploy
```

## Environment Variables

See [`.env.example`](../.env.example) for the complete list. Never commit `.env` to version control.

## Health Check

```
GET /api/v1/health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-06-13T12:00:00.000Z"
}
```

Use this endpoint for load balancer and container health checks.

## Reverse Proxy Example (nginx)

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

For Stripe webhooks, ensure the raw request body is forwarded without modification.
