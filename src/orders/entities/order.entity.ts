import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { OrderItem } from './order-item.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Shift } from '../../shifts/entities/shift.entity';

export enum OrderStatus {
  PENDING   = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  VOIDED    = 'voided',
}

export enum PaymentMethod {
  CASH     = 'cash',
  CARD     = 'card',
  TRANSFER = 'transfer',
}

export enum OrderChannel {
  POS     = 'pos',
  CHATBOT = 'chatbot',
  WEB     = 'web',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  orderNumber: string;

  /** Número visible por turno: #1, #2, #3... se reinicia con cada turno */
  @Column({ default: 0 })
  ticketNumber: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: OrderChannel, default: OrderChannel.POS })
  channel: OrderChannel;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true, type: 'text' })
  voidReason: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  voidedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, eager: true })
  voidedBy: User | null;

  @ManyToOne(() => Branch, branch => branch.orders, { eager: true })
  branch: Branch;

  @ManyToOne(() => User, user => user.orders, { eager: true })
  user: User;

  @ManyToOne(() => Customer, customer => customer.orders, { nullable: true, eager: true })
  customer: Customer;

  @ManyToOne(() => Shift, { nullable: true, eager: false })
  shift: Shift;

  @OneToMany(() => OrderItem, item => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
