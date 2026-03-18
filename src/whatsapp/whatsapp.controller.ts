import {
  Body, Controller, Delete, ForbiddenException, Get, Param,
  ParseIntPipe, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { SaveWhatsappConfigDto, SaveKeywordDto, UpdateKeywordDto } from './dto/whatsapp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkipSubscription } from '../subscriptions/skip-subscription.decorator';

// ── Webhook público (Meta llama sin JWT) ──────────────────────────────────────
@Controller('webhooks/whatsapp')
@SkipSubscription()
export class WhatsappWebhookController {
  constructor(private readonly service: WhatsappService) {}

  @Get()
  async verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    if (mode !== 'subscribe') return 'Ignored';
    const valid = await this.service.validateVerifyToken(token);
    if (!valid) throw new ForbiddenException('Invalid verify token');
    return challenge ?? 'OK';
  }

  @Post()
  async handleWebhook(@Body() payload: unknown) {
    await this.service.handleIncomingMessage(payload);
    return 'EVENT_RECEIVED';
  }
}

// ── Config autenticado ────────────────────────────────────────────────────────
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}

  @Get('config')
  getConfig(@Request() req) {
    return this.service.getConfig(req.user.orgId);
  }

  @Post('config')
  saveConfig(@Request() req, @Body() dto: SaveWhatsappConfigDto) {
    return this.service.saveConfig(req.user.orgId, dto);
  }

  @Get('keywords')
  getKeywords(@Request() req) {
    return this.service.getKeywords(req.user.orgId);
  }

  @Post('keywords')
  createKeyword(@Request() req, @Body() dto: SaveKeywordDto) {
    return this.service.createKeyword(req.user.orgId, dto);
  }

  @Patch('keywords/:id')
  updateKeyword(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKeywordDto,
  ) {
    return this.service.updateKeyword(req.user.orgId, id, dto);
  }

  @Delete('keywords/:id')
  deleteKeyword(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteKeyword(req.user.orgId, id);
  }
}
