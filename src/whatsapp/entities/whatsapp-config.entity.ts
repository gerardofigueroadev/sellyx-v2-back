import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { WhatsappKeyword } from './whatsapp-keyword.entity';

@Entity('whatsapp_configs')
export class WhatsappConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orgId: number;

  @Column()
  phoneNumberId: string;

  @Column('text')
  accessToken: string;

  @Column()
  verifyToken: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => WhatsappKeyword, k => k.config, { cascade: true, eager: true })
  keywords: WhatsappKeyword[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
