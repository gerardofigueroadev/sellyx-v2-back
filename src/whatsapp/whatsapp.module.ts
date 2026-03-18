import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappConfig } from './entities/whatsapp-config.entity';
import { WhatsappKeyword } from './entities/whatsapp-keyword.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController, WhatsappWebhookController } from './whatsapp.controller';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappConfig, WhatsappKeyword, Product, Order])],
  controllers: [WhatsappWebhookController, WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
