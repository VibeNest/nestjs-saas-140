import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { prisma, createTestApp } from './helpers/test-app.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'New',
        lastName: 'User',
      })
      .expect(201);

    expect(response.body.message).toContain('Registration successful');
  });

  it('rejects duplicate registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
      })
      .expect(409);
  });

  it('logs in with valid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'loginuser@example.com',
        password: 'SecurePass123!',
      });

    const token = await prisma.emailVerificationToken.findFirst({
      where: { user: { email: 'loginuser@example.com' } },
    });

    if (token) {
      await request(app.getHttpServer())
        .get(`/api/v1/auth/verify-email?token=${token.token}`)
        .expect(200);
    }

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'loginuser@example.com',
        password: 'SecurePass123!',
      })
      .expect(201);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
  });

  it('rejects invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'WrongPass123!',
      })
      .expect(401);
  });

  it('refreshes tokens', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'refreshuser@example.com',
        password: 'SecurePass123!',
      });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'refreshuser@example.com',
        password: 'SecurePass123!',
      });

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(201);

    expect(refreshResponse.body.accessToken).toBeDefined();
    expect(refreshResponse.body.refreshToken).toBeDefined();
    expect(refreshResponse.body.refreshToken).not.toBe(
      loginResponse.body.refreshToken,
    );
  });

  it('logs out and revokes refresh token', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'Admin123!',
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(401);
  });

  it('handles forgot and reset password flow', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'resetuser@example.com',
        password: 'SecurePass123!',
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'resetuser@example.com' })
      .expect(201);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { user: { email: 'resetuser@example.com' } },
    });

    expect(resetToken).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken!.token,
        password: 'NewSecurePass123!',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'resetuser@example.com',
        password: 'NewSecurePass123!',
      })
      .expect(201);
  });
});
