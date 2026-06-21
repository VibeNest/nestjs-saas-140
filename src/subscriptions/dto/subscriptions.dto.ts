import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  @IsNotEmpty()
  planSlug: string;
}

export class PlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  priceCents: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  interval: string;

  @ApiProperty()
  features: unknown;

  @ApiProperty()
  isActive: boolean;
}

export class SubscriptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiPropertyOptional()
  currentPeriodStart?: Date | null;

  @ApiPropertyOptional()
  currentPeriodEnd?: Date | null;

  @ApiProperty()
  cancelAtPeriodEnd: boolean;

  @ApiProperty({ type: PlanResponseDto })
  plan: PlanResponseDto;
}

export class CheckoutSessionResponseDto {
  @ApiProperty()
  url: string;

  @ApiProperty()
  sessionId: string;
}

export class PortalSessionResponseDto {
  @ApiProperty()
  url: string;
}
