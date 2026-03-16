import { IsString, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  /** Org code for tenant-scoped login. Leave empty for superadmin. */
  @IsString()
  @IsOptional()
  orgCode?: string;
}
