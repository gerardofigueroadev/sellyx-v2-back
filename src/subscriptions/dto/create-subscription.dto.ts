import { IsNumber, IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { SubscriptionStatus } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @IsNumber()
  orgId: number;

  @IsNumber()
  planId: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
