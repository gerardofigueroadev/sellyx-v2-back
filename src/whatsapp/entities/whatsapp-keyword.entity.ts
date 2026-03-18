import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { WhatsappConfig } from './whatsapp-config.entity';

export type KeywordResponseType = 'text' | 'menu' | 'order_status';

@Entity('whatsapp_keywords')
export class WhatsappKeyword {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  keyword: string;

  @Column({ type: 'varchar', default: 'text' })
  responseType: KeywordResponseType;

  @Column('text', { nullable: true })
  response: string | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => WhatsappConfig, c => c.keywords, { onDelete: 'CASCADE' })
  config: WhatsappConfig;
}
