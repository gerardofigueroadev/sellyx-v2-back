import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query, HttpCode } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Permissions('sales:create')
  create(@Body() dto: CreateOrderDto, @Request() req) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    const branchId = (isAdmin && dto.branchId) ? dto.branchId : req.user.branchId;
    return this.ordersService.create(dto, req.user.id, branchId, req.user.orgId);
  }

  @Get()
  @Permissions('sales:view')
  findAll(@Request() req, @Query('branchId') branchId?: string) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    const resolvedBranchId = isAdmin
      ? (branchId ? +branchId : undefined)
      : req.user.branchId;
    return this.ordersService.findAll(resolvedBranchId, req.user.orgId);
  }

  @Get('stats')
  @Permissions('sales:view')
  getStats(@Request() req) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    return this.ordersService.getStats(
      isAdmin ? undefined : req.user.branchId,
      req.user.orgId,
    );
  }

  @Get(':id')
  @Permissions('sales:view')
  findOne(@Param('id') id: string) { return this.ordersService.findOne(+id); }

  @Patch(':id/complete')
  @Permissions('sales:create')
  complete(@Param('id') id: string) { return this.ordersService.complete(+id); }

  @Patch(':id/cancel')
  @Permissions('sales:create')
  cancel(@Param('id') id: string) { return this.ordersService.cancel(+id); }

  @Patch(':id/void')
  @Permissions('orders:void')
  @HttpCode(200)
  voidOrder(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    return this.ordersService.voidOrder(+id, body.reason, req.user.id, req.user.orgId);
  }
}
