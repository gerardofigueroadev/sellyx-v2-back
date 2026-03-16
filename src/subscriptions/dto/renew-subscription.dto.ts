import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RenewSubscriptionDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  days?: number; // If omitted, uses the plan's durationDays

  @IsOptional()
  @IsString()
  notes?: string;
}
