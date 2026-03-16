import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards, Request, ForbiddenException, ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { SkipSubscription } from './skip-subscription.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';

function requireSuperAdmin(req: any) {
  if (req.user?.role !== 'superadmin') throw new ForbiddenException('Solo superadmin puede realizar esta acción');
}

@UseGuards(JwtAuthGuard)
@Controller()
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  // ─── Plans ────────────────────────────────────────────────────────────────

  @Get('plans')
  @SkipSubscription()
  findAllPlans() {
    return this.service.findAllPlans();
  }

  @Post('plans')
  @SkipSubscription()
  createPlan(@Body() dto: CreatePlanDto, @Request() req) {
    requireSuperAdmin(req);
    return this.service.createPlan(dto);
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────

  /** My organization's current subscription — accessible even if expired */
  @Get('subscriptions/my')
  @SkipSubscription()
  getMySubscription(@Request() req) {
    return this.service.getMySubscription(req.user.orgId);
  }

  /** All subscriptions (superadmin only) */
  @Get('subscriptions')
  @SkipSubscription()
  findAll(@Request() req) {
    requireSuperAdmin(req);
    return this.service.findAll();
  }

  /** Create subscription for an org (superadmin only) */
  @Post('subscriptions')
  @SkipSubscription()
  create(@Body() dto: CreateSubscriptionDto, @Request() req) {
    requireSuperAdmin(req);
    return this.service.create(dto);
  }

  /** Renew a subscription (superadmin only) */
  @Patch('subscriptions/:id/renew')
  @SkipSubscription()
  renew(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenewSubscriptionDto,
    @Request() req,
  ) {
    requireSuperAdmin(req);
    return this.service.renew(id, dto);
  }

  /** Cancel a subscription (superadmin only) */
  @Patch('subscriptions/:id/cancel')
  @SkipSubscription()
  cancel(@Param('id', ParseIntPipe) id: number, @Request() req) {
    requireSuperAdmin(req);
    return this.service.cancel(id);
  }

  /** Delete a subscription (superadmin only) */
  @Delete('subscriptions/:id')
  @SkipSubscription()
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    requireSuperAdmin(req);
    return this.service.remove(id);
  }
}
