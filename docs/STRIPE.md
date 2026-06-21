# Stripe Integration Guide

## Setup

1. Create a [Stripe account](https://dashboard.stripe.com/register)
2. Enable Stripe in `.env`:
   ```
   STRIPE_ENABLED=true
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. Create products and prices in Stripe Dashboard
4. Update `prisma/seed.ts` with your real Stripe price IDs
5. Re-run seed: `npm run db:seed`

Stripe stays **disabled by default** (`STRIPE_ENABLED=false`) until you provide valid keys. Placeholder keys are ignored automatically.

## Webhook Setup

### Local Development (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

Copy the webhook signing secret to `.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Production

1. Add webhook endpoint: `https://yourdomain.com/api/v1/webhooks/stripe`
2. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Copy signing secret to production env

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/subscriptions/plans` | List plans (public) |
| GET | `/subscriptions/me` | Current subscription |
| POST | `/subscriptions/checkout` | Create Checkout session |
| POST | `/subscriptions/portal` | Customer Portal session |
| POST | `/webhooks/stripe` | Webhook handler |

## Checkout Flow

1. Client calls `POST /subscriptions/checkout` with `{ planSlug: "pro" }`
2. Server creates Stripe Checkout Session
3. Client redirects user to returned `url`
4. On success, Stripe sends `checkout.session.completed` webhook
5. Server syncs subscription to database

## Default Plans

| Slug | Name | Price | Stripe |
|---|---|---|---|
| `free` | Free | $0 | No Stripe price |
| `pro` | Pro | $29/mo | Replace in seed |
| `enterprise` | Enterprise | $99/mo | Replace in seed |

Replace placeholder price IDs in `prisma/seed.ts` with your Stripe Dashboard price IDs.

## Disabling Stripe

```
STRIPE_ENABLED=false
```

Billing endpoints return **503 Service Unavailable** when disabled.
