import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Plan)
    private plansRepo: Repository<Plan>,
    @InjectRepository(Subscription)
    private subsRepo: Repository<Subscription>,
  ) {}

  // ─── Plans ────────────────────────────────────────────────────────────────

  findAllPlans(): Promise<Plan[]> {
    return this.plansRepo.find({ order: { price: 'ASC' } });
  }

  createPlan(dto: CreatePlanDto): Promise<Plan> {
    return this.plansRepo.save(this.plansRepo.create(dto));
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────

  findAll(): Promise<Subscription[]> {
    return this.subsRepo.find({
      relations: ['organization', 'plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async findCurrentForOrg(orgId: number): Promise<Subscription | null> {
    return this.subsRepo.findOne({
      where: { organization: { id: orgId } },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async isActiveForOrg(orgId: number): Promise<boolean> {
    const sub = await this.findCurrentForOrg(orgId);
    if (!sub) return false;
    if (sub.status === SubscriptionStatus.CANCELLED) return false;

    const now = new Date();
    const end = new Date(sub.endDate);
    end.setHours(23, 59, 59, 999);

    if (now > end) {
      // Auto-mark as expired
      if (sub.status !== SubscriptionStatus.EXPIRED) {
        await this.subsRepo.update(sub.id, { status: SubscriptionStatus.EXPIRED });
      }
      return false;
    }
    return true;
  }

  async getMySubscription(orgId: number) {
    const sub = await this.findCurrentForOrg(orgId);
    if (!sub) return null;

    const now = new Date();
    const end = new Date(sub.endDate);
    end.setHours(23, 59, 59, 999);
    const isExpired = now > end || sub.status === SubscriptionStatus.CANCELLED;
    const daysRemaining = isExpired
      ? 0
      : Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));

    return {
      id: sub.id,
      status: isExpired ? SubscriptionStatus.EXPIRED : sub.status,
      planName: sub.plan.name,
      planDescription: sub.plan.description,
      price: Number(sub.plan.price),
      durationDays: sub.plan.durationDays,
      startDate: sub.startDate,
      endDate: sub.endDate,
      daysRemaining,
      maxBranches: sub.plan.maxBranches,
      maxUsers: sub.plan.maxUsers,
      maxProducts: sub.plan.maxProducts,
    };
  }

  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    const plan = await this.plansRepo.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const start = new Date(dto.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + plan.durationDays);

    const sub = this.subsRepo.create({
      organization: { id: dto.orgId } as any,
      plan,
      status: dto.status ?? SubscriptionStatus.ACTIVE,
      startDate: dto.startDate,
      endDate: end.toISOString().split('T')[0],
      notes: dto.notes,
    });
    return this.subsRepo.save(sub);
  }

  async renew(id: number, dto: RenewSubscriptionDto): Promise<Subscription> {
    const sub = await this.subsRepo.findOne({ where: { id }, relations: ['plan'] });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');

    const days = dto.days ?? sub.plan.durationDays;
    // If expired, renew from today; otherwise extend from current endDate
    const base = sub.status === SubscriptionStatus.EXPIRED ? new Date() : new Date(sub.endDate);
    base.setDate(base.getDate() + days);

    sub.endDate = base.toISOString().split('T')[0];
    sub.status = SubscriptionStatus.ACTIVE;
    if (dto.notes) sub.notes = dto.notes;
    return this.subsRepo.save(sub);
  }

  async cancel(id: number): Promise<Subscription> {
    const sub = await this.subsRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    sub.status = SubscriptionStatus.CANCELLED;
    return this.subsRepo.save(sub);
  }

  async remove(id: number): Promise<void> {
    const sub = await this.subsRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    await this.subsRepo.remove(sub);
  }

  // ─── Seeding ──────────────────────────────────────────────────────────────

  /** Seed platform plans. Idempotent. Call once at startup. */
  async seedPlans(): Promise<void> {
    const planCount = await this.plansRepo.count();
    if (planCount > 0) return;
    await this.plansRepo.save([
      this.plansRepo.create({ name: 'Trial',      description: 'Prueba gratuita 14 días',          price: 0,   durationDays: 14,  maxBranches: 1,  maxUsers: 3,  maxProducts: 20  }),
      this.plansRepo.create({ name: 'Básico',     description: 'Para pequeños negocios',           price: 29,  durationDays: 30,  maxBranches: 1,  maxUsers: 5,  maxProducts: 100 }),
      this.plansRepo.create({ name: 'Pro',        description: 'Para negocios en crecimiento',     price: 79,  durationDays: 30,  maxBranches: 3,  maxUsers: 15, maxProducts: -1  }),
      this.plansRepo.create({ name: 'Enterprise', description: 'Sucursales y usuarios ilimitados', price: 199, durationDays: 365, maxBranches: -1, maxUsers: -1, maxProducts: -1  }),
    ]);
    console.log('✓ Planes de suscripción creados');
  }

  /** Create a trial subscription for a new org. Idempotent. */
  async seedTrial(orgId: number): Promise<void> {
    const existing = await this.subsRepo.findOne({ where: { organization: { id: orgId } } });
    if (existing) return;
    const trial = await this.plansRepo.findOne({ where: { name: 'Trial' } });
    if (!trial) return;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + trial.durationDays);
    await this.subsRepo.save(this.subsRepo.create({
      organization: { id: orgId } as any,
      plan: trial,
      status: SubscriptionStatus.TRIAL,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      notes: 'Suscripción trial automática',
    }));
    console.log(`✓ Suscripción trial creada para organización #${orgId}`);
  }
}
