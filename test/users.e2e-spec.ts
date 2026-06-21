import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { prisma, createTestApp, getAdminToken } from './helpers/test-app.helper';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await getAdminToken(app);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'regularuser@example.com',
        password: 'SecurePass123!',
        firstName: 'Regular',
        lastName: 'User',
      });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'regularuser@example.com',
        password: 'SecurePass123!',
      });

    userToken = loginResponse.body.accessToken;

    const user = await prisma.user.findUnique({
      where: { email: 'regularuser@example.com' },
    });
    userId = user!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users/me returns profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.email).toBe('regularuser@example.com');
    expect(response.body.password).toBeUndefined();
  });

  it('PATCH /users/me updates profile', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ firstName: 'Updated' })
      .expect(200);

    expect(response.body.firstName).toBe('Updated');
  });

  it('denies regular user from listing all users', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('allows admin to list users', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.total).toBeGreaterThan(0);
  });

  it('allows admin to change user role', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' })
      .expect(200);

    expect(response.body.role).toBe('ADMIN');
  });

  it('allows admin to deactivate user', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    expect(response.body.isActive).toBe(false);
  });
});
