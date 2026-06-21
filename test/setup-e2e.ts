import { createHmac } from 'crypto';
import { prisma, truncateAllTables, seedTestData } from './helpers/test-app.helper';

beforeAll(async () => {
  await prisma.$connect();
  await truncateAllTables();
  await seedTestData();
});

afterEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { not: 'admin@example.com' } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

export function createStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
