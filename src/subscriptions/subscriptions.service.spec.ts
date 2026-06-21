import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: jest.Mocked<PrismaService>;
  let stripeService: jest.Mocked<StripeService>;

  beforeEach(async () => {
    prisma = {
      plan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    stripeService = {
      isEnabled: jest.fn().mockReturnValue(true),
      createCustomer: jest.fn().mockResolvedValue('cus_123'),
      createCheckoutSession: jest.fn().mockResolvedValue({
        url: 'https://checkout.stripe.com/test',
        id: 'cs_123',
      }),
      createPortalSession: jest.fn().mockResolvedValue({
        url: 'https://billing.stripe.com/test',
      }),
      getClient: jest.fn(),
    } as unknown as jest.Mocked<StripeService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripeService },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('returns active plans', async () => {
    const plans = [{ id: '1', slug: 'free', name: 'Free' }];
    (prisma.plan.findMany as jest.Mock).mockResolvedValue(plans);

    const result = await service.getPlans();
    expect(result).toEqual(plans);
  });

  it('creates checkout session', async () => {
    (prisma.plan.findUnique as jest.Mock).mockResolvedValue({
      id: 'plan-1',
      slug: 'pro',
      isActive: true,
      stripePriceId: 'price_123',
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      stripeCustomerId: null,
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    const result = await service.createCheckoutSession('user-1', 'pro');

    expect(result.url).toContain('checkout.stripe.com');
    expect(stripeService.createCustomer).toHaveBeenCalled();
  });

  it('throws when plan not found', async () => {
    (prisma.plan.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.createCheckoutSession('user-1', 'invalid'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when plan has no stripe price', async () => {
    (prisma.plan.findUnique as jest.Mock).mockResolvedValue({
      id: 'plan-1',
      slug: 'free',
      isActive: true,
      stripePriceId: null,
    });

    await expect(
      service.createCheckoutSession('user-1', 'free'),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('StripeService', () => {
  it('reports disabled when stripe.enabled is false', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'stripe.enabled') return false;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const service = module.get<StripeService>(StripeService);
    expect(service.isEnabled()).toBe(false);
  });
});
