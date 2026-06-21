import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getAdminToken } from './helpers/test-app.helper';

describe('Subscriptions (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await getAdminToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /subscriptions/plans returns active plans', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/plans')
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].slug).toBeDefined();
  });

  it('GET /subscriptions/me returns null when no subscription', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toBeNull();
  });

  it('POST /subscriptions/checkout returns 503 when Stripe disabled', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planSlug: 'pro' })
      .expect(503);
  });

  it('POST /webhooks/stripe returns 503 when Stripe disabled', async () => {
    const payload = JSON.stringify({ type: 'test.event', data: { object: {} } });

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'invalid')
      .send(payload)
      .expect(503);
  });
});
