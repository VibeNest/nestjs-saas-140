import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  controllers: [SubscriptionsController, WebhooksController],
  providers: [StripeService, SubscriptionsService],
  exports: [StripeService, SubscriptionsService],
})
export class SubscriptionsModule {}
