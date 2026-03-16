import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CloseShiftDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  closingAmount: number;

  @IsString()
  @IsOptional()
  notes?: string;

  /** Si true, cancela automáticamente los pedidos pendientes del turno antes de cerrar */
  @IsBoolean()
  @IsOptional()
  cancelPending?: boolean;
}
