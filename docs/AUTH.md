# Authentication Guide

## Token Flow

```
Register → Verify Email → Login → Access Token (15m) + Refresh Token (7d)
                                    ↓
                              API requests (Bearer token)
                                    ↓
                              Token expires → POST /refresh → New token pair
                                    ↓
                              POST /logout → Refresh token revoked
```

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create account |
| POST | `/auth/login` | Public | Get tokens |
| POST | `/auth/refresh` | Public | Rotate tokens |
| POST | `/auth/logout` | Bearer | Revoke refresh token |
| GET | `/auth/verify-email` | Public | Verify email |
| POST | `/auth/forgot-password` | Public | Send reset email |
| POST | `/auth/reset-password` | Public | Reset password |
| POST | `/auth/oauth/exchange` | Public | Exchange OAuth code for tokens |

## Refresh Token Delivery

Set `REFRESH_TOKEN_DELIVERY` in `.env`:

- `body` (default) — Refresh token returned in JSON response
- `cookie` — Refresh token set as httpOnly cookie (omit `refreshToken` from request body)

## OAuth Setup

OAuth uses a **secure one-time code exchange** — tokens are never exposed in the redirect URL.

### Flow

1. User visits `GET /auth/google` or `GET /auth/github`
2. Provider redirects to callback
3. API redirects to `{FRONTEND_URL}/auth/callback?code=...` (60s one-time code)
4. Frontend calls `POST /auth/oauth/exchange` with `{ "code": "..." }`
5. API returns `{ accessToken, refreshToken }`

### Google

1. Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/)
2. Set authorized redirect URI to `GOOGLE_CALLBACK_URL` from `.env`
3. Enable in `.env`:
   ```
   GOOGLE_OAUTH_ENABLED=true
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

### GitHub

1. Create OAuth App at [GitHub Developer Settings](https://github.com/settings/developers)
2. Set callback URL to `GITHUB_CALLBACK_URL` from `.env`
3. Enable in `.env`:
   ```
   GITHUB_OAUTH_ENABLED=true
   GITHUB_CLIENT_ID=your-client-id
   GITHUB_CLIENT_SECRET=your-client-secret
   ```

## Email Verification

Set `REQUIRE_EMAIL_VERIFICATION=true` in production to block login until email is verified.

## Security Notes

- Change `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `OAUTH_EXCHANGE_SECRET` in production
- Use HTTPS in production (required for secure cookies)
- Refresh tokens are stored hashed in the database
- Password reset revokes all active refresh tokens
- Old password reset tokens are invalidated when a new reset is requested
- Auth routes are rate-limited (see `THROTTLE_*` env vars)
- OAuth linking to existing accounts requires verified email when a password is set
