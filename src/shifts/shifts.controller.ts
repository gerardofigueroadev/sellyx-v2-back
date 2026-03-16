import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query, ParseIntPipe, Optional, BadRequestException } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('shifts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  /** Abrir caja — el cajero inicia su turno */
  @Post('open')
  @Permissions('sales:create')
  open(@Body() dto: OpenShiftDto, @Request() req) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    const branchId = (isAdmin && dto.branchId) ? dto.branchId : req.user.branchId;
    if (!branchId) throw new BadRequestException('Debes tener una sucursal asignada para abrir caja. Selecciona una sucursal primero.');
    return this.service.open(dto, req.user.id, branchId);
  }

  /** Cerrar caja — el cajero termina su turno */
  @Patch(':id/close')
  @Permissions('sales:create')
  close(@Param('id') id: string, @Body() dto: CloseShiftDto, @Request() req) {
    return this.service.close(+id, dto, req.user.orgId);
  }

  /** Turno activo de la sucursal del usuario */
  @Get('active')
  @Permissions('sales:create')
  getActive(@Request() req, @Query('branchId') branchId?: string) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    const resolvedBranchId = (isAdmin && branchId) ? +branchId : req.user.branchId;
    return this.service.findActivePosForBranch(resolvedBranchId);
  }

  /** Historial de turnos (admin ve todos, cajero ve los de su sucursal) */
  @Get()
  @Permissions('sales:view')
  findAll(@Request() req) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    return this.service.findAll(req.user.orgId, isAdmin ? undefined : req.user.branchId);
  }

  /** Resumen de un turno específico */
  @Get(':id/summary')
  @Permissions('sales:view')
  summary(@Param('id') id: string, @Request() req) {
    return this.service.getSummary(+id, req.user.orgId);
  }

  /** Reporte completo para impresión de cierre */
  @Get(':id/report')
  @Permissions('sales:view')
  report(@Param('id') id: string, @Request() req) {
    return this.service.getReport(+id, req.user.orgId);
  }
}
