import {
  Controller,
  Headers,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/auth.decorators';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('webhooks')
@Controller('webhooks')
@SkipThrottle()
export class WebhooksController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Public()
  @Post('stripe')
  @ApiOperation({ summary: 'Stripe webhook handler' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!this.stripeService.isEnabled()) {
      throw new ServiceUnavailableException('Stripe is not enabled');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new ServiceUnavailableException('Raw body not available');
    }

    const event = this.stripeService.constructWebhookEvent(rawBody, signature);
    await this.subscriptionsService.handleWebhookEvent(event);

    return { received: true };
  }
}
