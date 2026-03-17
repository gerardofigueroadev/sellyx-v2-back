import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('sales:view')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  private dates(from?: string, to?: string) {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: from ?? today, to: to ?? today };
  }

  private branchId(req: any, branchId?: string): number | undefined {
    const isAdmin = req.user.permissions?.includes('orders:view_all');
    if (!isAdmin) return req.user.branchId;
    return branchId ? +branchId : undefined;
  }

  @Get('summary')
  summary(@Query('from') from: string, @Query('to') to: string,
          @Query('branchId') branchId: string, @Request() req) {
    const d = this.dates(from, to);
    return this.service.getSummary(req.user.orgId, d.from, d.to, this.branchId(req, branchId));
  }

  @Get('by-hour')
  byHour(@Query('from') from: string, @Query('to') to: string,
         @Query('branchId') branchId: string, @Request() req) {
    const d = this.dates(from, to);
    return this.service.getSalesByHour(req.user.orgId, d.from, d.to, this.branchId(req, branchId));
  }

  @Get('by-day')
  byDay(@Query('from') from: string, @Query('to') to: string,
        @Query('branchId') branchId: string, @Request() req) {
    const d = this.dates(from, to);
    return this.service.getSalesByDay(req.user.orgId, d.from, d.to, this.branchId(req, branchId));
  }

  @Get('products')
  products(@Query('from') from: string, @Query('to') to: string,
           @Query('branchId') branchId: string, @Request() req) {
    const d = this.dates(from, to);
    return this.service.getTopProducts(req.user.orgId, d.from, d.to, this.branchId(req, branchId));
  }

  @Get('shifts')
  shifts(@Query('from') from: string, @Query('to') to: string,
         @Query('branchId') branchId: string, @Request() req) {
    const d = this.dates(from, to);
    return this.service.getShiftsSummary(req.user.orgId, d.from, d.to, this.branchId(req, branchId));
  }
}
