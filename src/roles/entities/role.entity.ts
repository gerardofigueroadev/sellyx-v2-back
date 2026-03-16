import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, OneToMany, ManyToOne } from 'typeorm';
import { Permission } from '../../permissions/entities/permission.entity';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // 'superadmin' | 'admin' | 'cajero'

  @Column({ nullable: true })
  description: string;

  // null = system role (superadmin); set = org-specific role
  @ManyToOne(() => Organization, { nullable: true, eager: false, onDelete: 'CASCADE' })
  organization: Organization | null;

  @Column({ nullable: true })
  organizationId: number | null;

  @ManyToMany(() => Permission, permission => permission.roles, { eager: true })
  @JoinTable({ name: 'role_permissions' })
  permissions: Permission[];

  @OneToMany(() => User, user => user.role)
  users: User[];
}
