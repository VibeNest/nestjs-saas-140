import {
  Body,
  Controller,
  Get,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  CheckoutDto,
  CheckoutSessionResponseDto,
  PlanResponseDto,
  PortalSessionResponseDto,
  SubscriptionResponseDto,
} from './dto/subscriptions.dto';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
  ) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List available subscription plans' })
  @ApiResponse({ status: 200, type: [PlanResponseDto] })
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription' })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  getMySubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getUserSubscription(user.id);
  }

  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  @ApiResponse({ status: 201, type: CheckoutSessionResponseDto })
  createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
  ) {
    if (!this.stripeService.isEnabled()) {
      throw new ServiceUnavailableException('Stripe is not enabled');
    }
    return this.subscriptionsService.createCheckoutSession(
      user.id,
      dto.planSlug,
    );
  }

  @Post('portal')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe customer portal session' })
  @ApiResponse({ status: 201, type: PortalSessionResponseDto })
  createPortal(@CurrentUser() user: AuthenticatedUser) {
    if (!this.stripeService.isEnabled()) {
      throw new ServiceUnavailableException('Stripe is not enabled');
    }
    return this.subscriptionsService.createPortalSession(user.id);
  }
}
