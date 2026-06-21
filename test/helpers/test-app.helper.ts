import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

export const prisma = new PrismaClient();

export async function truncateAllTables() {
  const tables = [
    'password_reset_tokens',
    'email_verification_tokens',
    'refresh_tokens',
    'oauth_accounts',
    'subscriptions',
    'plans',
    'users',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
}

export async function seedTestData() {
  const bcrypt = await import('bcrypt');
  const hashedPassword = await bcrypt.hash('Admin123!', 4);

  await prisma.plan.createMany({
    data: [
      {
        name: 'Free',
        slug: 'free',
        description: 'Free tier',
        priceCents: 0,
        features: ['Basic'],
        sortOrder: 0,
      },
      {
        name: 'Pro',
        slug: 'pro',
        description: 'Pro tier',
        stripePriceId: 'price_test_pro',
        priceCents: 2900,
        features: ['Pro features'],
        sortOrder: 1,
      },
    ],
  });

  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'SUPER_ADMIN',
      emailVerified: true,
    },
  });
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({ rawBody: true });
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';

  app.setGlobalPrefix(apiPrefix);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return app;
}

export async function registerUser(
  app: INestApplication,
  email: string,
  password = 'SecurePass123!',
) {
  const request = (await import('supertest')).default;
  return request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'Test', lastName: 'User' });
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password = 'SecurePass123!',
) {
  const request = (await import('supertest')).default;
  return request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password });
}

export async function getAdminToken(app: INestApplication) {
  const response = await loginUser(app, 'admin@example.com', 'Admin123!');
  return response.body.accessToken as string;
}
