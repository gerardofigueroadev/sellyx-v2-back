import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  /** Days of coverage per billing cycle */
  @Column({ default: 30 })
  durationDays: number;

  /** -1 = unlimited */
  @Column({ default: 1 })
  maxBranches: number;

  @Column({ default: 5 })
  maxUsers: number;

  @Column({ default: 50 })
  maxProducts: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
