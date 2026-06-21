import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<boolean>('stripe.enabled') === true;
  }

  getClient(): Stripe {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Stripe is not enabled. Set STRIPE_ENABLED=true and provide valid Stripe keys in .env',
      );
    }

    if (!this.stripe) {
      this.stripe = new Stripe(
        this.configService.get<string>('stripe.secretKey')!,
      );
    }

    return this.stripe;
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>(
      'stripe.webhookSecret',
    );

    if (!webhookSecret || webhookSecret.startsWith('whsec_Example')) {
      throw new ServiceUnavailableException(
        'Stripe webhook secret is not configured',
      );
    }

    try {
      return this.getClient().webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error) {
      this.logger.warn('Stripe webhook signature verification failed');
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  async createCustomer(email: string, userId: string): Promise<string> {
    try {
      const customer = await this.getClient().customers.create({
        email,
        metadata: { userId },
      });
      return customer.id;
    } catch (error) {
      this.handleStripeError(error, 'create Stripe customer');
    }
  }

  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    userId: string;
    planSlug: string;
  }): Promise<Stripe.Checkout.Session> {
    try {
      return await this.getClient().checkout.sessions.create({
        customer: params.customerId,
        mode: 'subscription',
        line_items: [{ price: params.priceId, quantity: 1 }],
        success_url: `${this.configService.get<string>('stripe.successUrl')}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: this.configService.get<string>('stripe.cancelUrl'),
        metadata: {
          userId: params.userId,
          planSlug: params.planSlug,
        },
      });
    } catch (error) {
      this.handleStripeError(error, 'create checkout session');
    }
  }

  async createPortalSession(
    customerId: string,
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      return await this.getClient().billingPortal.sessions.create({
        customer: customerId,
        return_url: this.configService.get<string>('app.frontendUrl'),
      });
    } catch (error) {
      this.handleStripeError(error, 'create billing portal session');
    }
  }

  private handleStripeError(error: unknown, action: string): never {
    const message =
      error instanceof Error ? error.message : 'Unknown Stripe error';
    this.logger.error(`Failed to ${action}: ${message}`);
    throw new BadRequestException(
      `Stripe error: unable to ${action}. Check your Stripe keys and plan configuration.`,
    );
  }
}
