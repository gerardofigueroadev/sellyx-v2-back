import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappConfig } from './entities/whatsapp-config.entity';
import { WhatsappKeyword } from './entities/whatsapp-keyword.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController, WhatsappWebhookController } from './whatsapp.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappConfig, WhatsappKeyword])],
  controllers: [WhatsappWebhookController, WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
