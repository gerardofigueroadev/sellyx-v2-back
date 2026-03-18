import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappConfig } from './entities/whatsapp-config.entity';
import { WhatsappKeyword } from './entities/whatsapp-keyword.entity';
import { SaveWhatsappConfigDto, SaveKeywordDto, UpdateKeywordDto } from './dto/whatsapp.dto';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(WhatsappConfig)
    private configRepo: Repository<WhatsappConfig>,
    @InjectRepository(WhatsappKeyword)
    private keywordRepo: Repository<WhatsappKeyword>,
  ) {}

  // ── Config ────────────────────────────────────────────────────────────────

  async getConfig(orgId: number): Promise<WhatsappConfig | null> {
    return this.configRepo.findOne({ where: { orgId }, relations: ['keywords'] });
  }

  async saveConfig(orgId: number, dto: SaveWhatsappConfigDto): Promise<WhatsappConfig> {
    let config = await this.configRepo.findOne({ where: { orgId } });
    if (config) {
      Object.assign(config, dto);
    } else {
      config = this.configRepo.create({ ...dto, orgId });
    }
    return this.configRepo.save(config);
  }

  // ── Keywords ──────────────────────────────────────────────────────────────

  async getKeywords(orgId: number): Promise<WhatsappKeyword[]> {
    const config = await this.configRepo.findOne({ where: { orgId } });
    if (!config) return [];
    return this.keywordRepo.find({ where: { config: { id: config.id } } });
  }

  async createKeyword(orgId: number, dto: SaveKeywordDto): Promise<WhatsappKeyword> {
    const config = await this.configRepo.findOne({ where: { orgId } });
    if (!config) throw new NotFoundException('Configura las credenciales de WhatsApp primero');
    const kw = this.keywordRepo.create({ ...dto, config });
    return this.keywordRepo.save(kw);
  }

  async updateKeyword(orgId: number, id: number, dto: UpdateKeywordDto): Promise<WhatsappKeyword> {
    const kw = await this.keywordRepo.findOne({ where: { id }, relations: ['config'] });
    if (!kw || kw.config.orgId !== orgId) throw new NotFoundException('Keyword no encontrada');
    Object.assign(kw, dto);
    return this.keywordRepo.save(kw);
  }

  async deleteKeyword(orgId: number, id: number): Promise<void> {
    const kw = await this.keywordRepo.findOne({ where: { id }, relations: ['config'] });
    if (!kw || kw.config.orgId !== orgId) throw new NotFoundException('Keyword no encontrada');
    await this.keywordRepo.remove(kw);
  }

  // ── Webhook ───────────────────────────────────────────────────────────────

  async validateVerifyToken(token?: string): Promise<boolean> {
    if (!token) return false;
    const config = await this.configRepo.findOne({ where: { verifyToken: token, isActive: true } });
    return !!config;
  }

  async handleIncomingMessage(payload: any): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') return;
    if (!payload?.entry?.length) return;

    for (const entry of payload.entry) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id;
        for (const message of change.value?.messages ?? []) {
          await this.handleMessage(message, phoneNumberId);
        }
      }
    }
  }

  private async handleMessage(message: any, phoneNumberId?: string): Promise<void> {
    if (!message?.from) return;

    const config = phoneNumberId
      ? await this.configRepo.findOne({ where: { phoneNumberId, isActive: true }, relations: ['keywords'] })
      : null;

    if (!config) {
      this.logger.warn(`No active config found for phoneNumberId: ${phoneNumberId}`);
      return;
    }

    const userText = message.text?.body?.trim()?.toLowerCase() ?? '';
    const keywords = config.keywords?.filter(k => k.isActive) ?? [];
    const match = keywords.find(k => userText.includes(k.keyword.toLowerCase()));

    let responseText: string;
    if (match) {
      responseText = match.response;
    } else {
      const list = keywords.map(k => `*${k.keyword}*`).join(', ');
      responseText = list
        ? `Hola! Puedes escribir: ${list}`
        : 'Hola! En este momento no podemos atenderte. Intenta más tarde.';
    }

    await this.sendTextMessage(config.accessToken, config.phoneNumberId, message.from, responseText);
  }

  private async sendTextMessage(accessToken: string, phoneNumberId: string, to: string, body: string): Promise<void> {
    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body } }),
      });
      if (!res.ok) this.logger.error(`WhatsApp API error: ${await res.text()}`);
    } catch (err) {
      this.logger.error(`Failed to send message: ${(err as Error).message}`);
    }
  }
}
