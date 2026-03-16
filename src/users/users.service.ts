import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Subscription } from '../subscriptions/entities/subscription.entity';

const RELATIONS = ['organization', 'branch', 'role', 'role.permissions'];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Subscription)
    private subsRepo: Repository<Subscription>,
  ) {}

  private async checkUserLimit(orgId: number): Promise<void> {
    const sub = await this.subsRepo.findOne({
      where: { organization: { id: orgId } },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
    if (!sub || sub.plan.maxUsers === -1) return;
    const count = await this.usersRepository.count({ where: { organization: { id: orgId } } });
    if (count >= sub.plan.maxUsers) {
      throw new ForbiddenException(`Límite de usuarios alcanzado según tu plan (${sub.plan.maxUsers})`);
    }
  }

  async create(dto: CreateUserDto, orgId: number): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: { username: dto.username, organization: { id: orgId } } });
    if (existing) throw new ConflictException('El nombre de usuario ya existe en esta organización');

    await this.checkUserLimit(orgId);

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      username: dto.username,
      password: hashedPassword,
      name: dto.name,
      email: (dto as any).email,
      organization: { id: orgId } as any,
      branch: dto.branchId ? { id: dto.branchId } as any : undefined,
      role: dto.roleId ? { id: dto.roleId } as any : undefined,
    });
    return this.usersRepository.save(user);
  }

  async findAll(orgId: number): Promise<User[]> {
    return this.usersRepository.find({
      where: { organization: { id: orgId } },
      relations: RELATIONS,
    }).then(users => users.filter(u => u.role?.name !== 'superadmin'));
  }

  async findOne(id: number, orgId?: number): Promise<User> {
    const where: any = { id };
    if (orgId) where.organization = { id: orgId };
    const user = await this.usersRepository.findOne({ where, relations: RELATIONS });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string): Promise<User> {
    return this.usersRepository.findOne({ where: { username }, relations: RELATIONS });
  }

  /** Login lookup: org-scoped by org code, or null-org lookup for superadmin. */
  async findByUsernameForLogin(username: string, orgCode?: string): Promise<User | null> {
    if (orgCode) {
      return this.usersRepository.findOne({
        where: { username, organization: { code: orgCode } },
        relations: RELATIONS,
      });
    }
    return this.usersRepository.findOne({
      where: { username, organizationId: IsNull() },
      relations: RELATIONS,
    });
  }

  async update(id: number, dto: UpdateUserDto, orgId?: number): Promise<User> {
    const user = await this.findOne(id, orgId);
    if (dto.password) {
      (dto as any).password = await bcrypt.hash(dto.password, 10);
    }
    if (dto.branchId !== undefined) (user as any).branch = dto.branchId ? { id: dto.branchId } : null;
    if (dto.roleId) (user as any).role = { id: dto.roleId };
    Object.assign(user, dto);
    return this.usersRepository.save(user);
  }

  async remove(id: number, orgId?: number): Promise<void> {
    const user = await this.findOne(id, orgId);
    await this.usersRepository.softRemove(user);
  }
}
