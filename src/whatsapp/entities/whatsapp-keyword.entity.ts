import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { WhatsappConfig } from './whatsapp-config.entity';

@Entity('whatsapp_keywords')
export class WhatsappKeyword {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  keyword: string;

  @Column('text')
  response: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => WhatsappConfig, c => c.keywords, { onDelete: 'CASCADE' })
  config: WhatsappConfig;
}
