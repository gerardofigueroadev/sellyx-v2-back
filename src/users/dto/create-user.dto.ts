import { IsString, IsOptional, MinLength, IsNumber, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  organizationId?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  branchId?: number;

  @IsNumber()
  @Type(() => Number)
  roleId: number;
}
