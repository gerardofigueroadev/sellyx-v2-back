import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  price: number;

  @IsString()
  @IsOptional()
  emoji?: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  stock?: number;

  @IsNumber()
  @Type(() => Number)
  categoryId: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  organizationId?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  branchId?: number;
}
