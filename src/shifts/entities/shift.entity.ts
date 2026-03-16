import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, OneToMany,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';

export enum ShiftType {
  POS    = 'pos',
  SYSTEM = 'system',
}

export enum ShiftStatus {
  OPEN   = 'open',
  CLOSED = 'closed',
}

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ShiftType, default: ShiftType.POS })
  type: ShiftType;

  @Column({ type: 'enum', enum: ShiftStatus, default: ShiftStatus.OPEN })
  status: ShiftStatus;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  openingAmount: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  closingAmount: number;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @ManyToOne(() => Branch, { eager: true, nullable: false })
  branch: Branch;

  @ManyToOne(() => User, { eager: true, nullable: true })
  user: User;
}
