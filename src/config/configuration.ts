import { registerAs } from '@nestjs/config';

const PLACEHOLDER_STRIPE_KEY_PATTERNS = [
  /^sk_test_51Example/i,
  /^whsec_Example/i,
  /^your-/i,
  /^change_me/i,
];

function isPlaceholderStripeKey(value: string): boolean {
  if (!value || value.trim().length === 0) {
    return true;
  }
  return PLACEHOLDER_STRIPE_KEY_PATTERNS.some((pattern) => pattern.test(value));
}

function isValidStripeSecretKey(value: string): boolean {
  return /^sk_(test|live)_[A-Za-z0-9]+$/.test(value);
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  refreshTokenDelivery:
    process.env.REFRESH_TOKEN_DELIVERY === 'cookie' ? 'cookie' : 'body',
  oauthExchangeSecret:
    process.env.OAUTH_EXCHANGE_SECRET ??
    process.env.JWT_ACCESS_SECRET ??
    'dev-oauth-exchange-secret',
}));

export const authConfig = registerAs('auth', () => ({
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10),
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.com',
  bootstrapAdminPassword:
    process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'Admin123!',
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
}));

export const emailConfig = registerAs('email', () => ({
  enabled: process.env.EMAIL_ENABLED !== 'false',
  host: process.env.SMTP_HOST ?? 'localhost',
  port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
  user: process.env.SMTP_USER ?? '',
  pass: process.env.SMTP_PASS ?? '',
  secure: process.env.SMTP_SECURE === 'true',
  from: process.env.EMAIL_FROM ?? 'noreply@example.com',
}));

export const googleOAuthConfig = registerAs('googleOAuth', () => ({
  enabled: process.env.GOOGLE_OAUTH_ENABLED === 'true',
  clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  callbackUrl:
    process.env.GOOGLE_CALLBACK_URL ??
    'http://localhost:3000/api/v1/auth/google/callback',
}));

export const githubOAuthConfig = registerAs('githubOAuth', () => ({
  enabled: process.env.GITHUB_OAUTH_ENABLED === 'true',
  clientId: process.env.GITHUB_CLIENT_ID ?? '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  callbackUrl:
    process.env.GITHUB_CALLBACK_URL ??
    'http://localhost:3000/api/v1/auth/github/callback',
}));

export const stripeConfig = registerAs('stripe', () => {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  const explicitlyEnabled = process.env.STRIPE_ENABLED === 'true';
  const explicitlyDisabled = process.env.STRIPE_ENABLED === 'false';
  const hasValidKey =
    isValidStripeSecretKey(secretKey) && !isPlaceholderStripeKey(secretKey);

  return {
    enabled: explicitlyDisabled
      ? false
      : explicitlyEnabled
        ? hasValidKey
        : hasValidKey,
    secretKey,
    webhookSecret,
    successUrl:
      process.env.STRIPE_SUCCESS_URL ??
      'http://localhost:5173/billing/success',
    cancelUrl:
      process.env.STRIPE_CANCEL_URL ?? 'http://localhost:5173/billing/cancel',
  };
});

export const throttlerConfig = registerAs('throttler', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
}));
