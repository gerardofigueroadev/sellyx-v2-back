import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { WhatsappConfig } from './entities/whatsapp-config.entity';
import { WhatsappKeyword } from './entities/whatsapp-keyword.entity';
import { Product } from '../products/entities/product.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { SaveWhatsappConfigDto, SaveKeywordDto, UpdateKeywordDto } from './dto/whatsapp.dto';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(WhatsappConfig)
    private configRepo: Repository<WhatsappConfig>,
    @InjectRepository(WhatsappKeyword)
    private keywordRepo: Repository<WhatsappKeyword>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
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
    const kw = this.keywordRepo.create({ ...dto, responseType: dto.responseType ?? 'text', config });
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
      responseText = await this.buildResponse(match, config.orgId, userText);
    } else {
      const list = keywords.map(k => `*${k.keyword}*`).join(', ');
      responseText = list
        ? `Hola! 👋 Puedes escribir: ${list}`
        : 'Hola! 👋 En este momento no podemos atenderte. Intenta más tarde.';
    }

    await this.sendTextMessage(config.accessToken, config.phoneNumberId, message.from, responseText);
  }

  // ── Generación de respuestas dinámicas ───────────────────────────────────

  private async buildResponse(kw: WhatsappKeyword, orgId: number, userText: string): Promise<string> {
    switch (kw.responseType) {
      case 'menu':
        return this.buildMenuMessage(orgId);
      case 'order_status':
        return this.buildOrderStatusMessage(orgId, userText);
      default:
        return kw.response ?? 'Gracias por contactarnos.';
    }
  }

  private async buildMenuMessage(orgId: number): Promise<string> {
    const products = await this.productRepo.find({
      where: { organization: { id: orgId }, isAvailable: true, deletedAt: IsNull() },
      relations: ['category'],
      order: { category: { name: 'ASC' }, name: 'ASC' },
    });

    if (!products.length) return 'En este momento el menú no está disponible. 😔';

    // Agrupar por categoría
    const byCategory = new Map<string, Product[]>();
    for (const p of products) {
      const cat = p.category?.name ?? 'Otros';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(p);
    }

    const lines: string[] = ['🍽️ *Nuestro Menú*\n'];
    for (const [cat, items] of byCategory) {
      lines.push(`*${cat}*`);
      for (const p of items) {
        const emoji = p.emoji ? `${p.emoji} ` : '▪️ ';
        lines.push(`${emoji}${p.name} — ${Number(p.price).toFixed(2)}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  private async buildOrderStatusMessage(orgId: number, userText: string): Promise<string> {
    // Extrae número de pedido del texto: "pedido 001", "orden 001", o solo "001"
    const match = userText.match(/\b([a-z0-9]{4,})\b/g);
    if (!match) return '📦 Escribe el número de tu pedido. Ejemplo: *pedido ORD-0001*';

    // Busca el orderNumber que contenga cualquiera de las palabras del mensaje
    let order: Order | null = null;
    for (const word of match) {
      order = await this.orderRepo.findOne({
        where: { branch: { organization: { id: orgId } }, orderNumber: word.toUpperCase() },
        relations: ['items', 'items.product'],
      });
      if (order) break;
    }

    if (!order) return '🔍 No encontramos ese pedido. Verifica el número e intenta de nuevo.';

    const statusLabel: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]:   '⏳ En preparación',
      [OrderStatus.COMPLETED]: '✅ Completado',
      [OrderStatus.CANCELLED]: '❌ Cancelado',
      [OrderStatus.VOIDED]:    '🚫 Anulado',
    };

    const lines = [
      `📦 *Pedido ${order.orderNumber}*`,
      `Estado: ${statusLabel[order.status] ?? order.status}`,
      `Total: ${Number(order.total).toFixed(2)}`,
    ];

    if (order.items?.length) {
      lines.push('\nProductos:');
      order.items.forEach(i => lines.push(`  • ${i.quantity}x ${i.product?.name ?? 'Producto'}`));
    }

    return lines.join('\n');
  }

  // ── Envío ─────────────────────────────────────────────────────────────────

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
