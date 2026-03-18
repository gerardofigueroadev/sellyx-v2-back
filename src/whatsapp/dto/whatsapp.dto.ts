import { IsString, IsBoolean, IsOptional } from 'class-validator';

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

  @IsString()
  response: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateKeywordDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsString()
  @IsOptional()
  response?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
