import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async getPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getUserSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      return null;
    }

    return subscription;
  }

  async createCheckoutSession(userId: string, planSlug: string) {
    if (!this.stripeService.isEnabled()) {
      throw new BadRequestException('Stripe is not enabled');
    }

    const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plan not found');
    }

    if (!plan.stripePriceId) {
      throw new BadRequestException('Plan is not configured for Stripe billing');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await this.stripeService.createCustomer(user.email, user.id);
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripeService.createCheckoutSession({
      customerId,
      priceId: plan.stripePriceId,
      userId,
      planSlug,
    });

    return {
      url: session.url!,
      sessionId: session.id,
    };
  }

  async createPortalSession(userId: string) {
    if (!this.stripeService.isEnabled()) {
      throw new BadRequestException('Stripe is not enabled');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer found for user');
    }

    const session = await this.stripeService.createPortalSession(
      user.stripeCustomerId,
    );

    return { url: session.url };
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIALING,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      unpaid: SubscriptionStatus.UNPAID,
      paused: SubscriptionStatus.PAUSED,
    };
    return statusMap[status] ?? SubscriptionStatus.INCOMPLETE;
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const planSlug = session.metadata?.planSlug;

    if (!userId || !planSlug) {
      return;
    }

    const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) {
      return;
    }

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!stripeSubscriptionId) {
      return;
    }

    await this.syncSubscriptionFromStripe(userId, plan.id, stripeSubscriptionId);
  }

  async syncSubscriptionFromStripe(
    userId: string,
    planId: string,
    stripeSubscriptionId: string,
  ) {
    const stripeSubscription = (await this.stripeService
      .getClient()
      .subscriptions.retrieve(stripeSubscriptionId)) as Stripe.Subscription;

    const periodStart = (stripeSubscription as Stripe.Subscription & {
      current_period_start?: number;
    }).current_period_start;
    const periodEnd = (stripeSubscription as Stripe.Subscription & {
      current_period_end?: number;
    }).current_period_end;

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        stripeSubscriptionId,
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart: periodStart
          ? new Date(periodStart * 1000)
          : null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
      update: {
        planId,
        stripeSubscriptionId,
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart: periodStart
          ? new Date(periodStart * 1000)
          : null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });
  }

  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const stripeSubscriptionId = subscription.id;
    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!existing) {
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

      const user = await this.prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
      });

      if (!user) {
        return;
      }

      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId
        ? await this.prisma.plan.findUnique({ where: { stripePriceId: priceId } })
        : null;

      if (!plan) {
        return;
      }

      await this.syncSubscriptionFromStripe(
        user.id,
        plan.id,
        stripeSubscriptionId,
      );
      return;
    }

    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId
      ? await this.prisma.plan.findUnique({ where: { stripePriceId: priceId } })
      : null;

    const periodStart = (subscription as Stripe.Subscription & {
      current_period_start?: number;
    }).current_period_start;
    const periodEnd = (subscription as Stripe.Subscription & {
      current_period_end?: number;
    }).current_period_end;

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: this.mapStripeStatus(subscription.status),
        planId: plan?.id ?? existing.planId,
        currentPeriodStart: periodStart
          ? new Date(periodStart * 1000)
          : null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!existing) {
      return;
    }

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: { status: SubscriptionStatus.CANCELED },
    });
  }

  async handlePaymentFailed(invoice: Stripe.Invoice) {
    const invoiceData = invoice as Stripe.Invoice & {
      subscription?: string | { id: string } | null;
    };
    const subscriptionId =
      typeof invoiceData.subscription === 'string'
        ? invoiceData.subscription
        : invoiceData.subscription?.id;

    if (!subscriptionId) {
      return;
    }

    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!existing) {
      return;
    }

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: { status: SubscriptionStatus.PAST_DUE },
    });
  }

  async handleWebhookEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  }
}
