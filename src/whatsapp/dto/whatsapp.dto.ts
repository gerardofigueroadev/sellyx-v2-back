import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator';

export class SaveWhatsappConfigDto {
  @IsString()
  phoneNumberId: string;

  @IsString()
  accessToken: string;

  @IsString()
  verifyToken: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SaveKeywordDto {
  @IsString()
  keyword: string;

  @IsIn(['text', 'menu', 'order_status'])
  @IsOptional()
  responseType?: string;

  @IsString()
  @IsOptional()
  response?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateKeywordDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsIn(['text', 'menu', 'order_status'])
  @IsOptional()
  responseType?: string;

  @IsString()
  @IsOptional()
  response?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
