import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Shift, ShiftStatus, ShiftType } from '../shifts/entities/shift.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private repo: Repository<Branch>,
    @InjectRepository(Shift)
    private shiftsRepo: Repository<Shift>,
    @InjectRepository(Subscription)
    private subsRepo: Repository<Subscription>,
  ) {}

  private async checkBranchLimit(orgId: number): Promise<void> {
    const sub = await this.subsRepo.findOne({
      where: { organization: { id: orgId } },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
    if (!sub || sub.plan.maxBranches === -1) return;
    const count = await this.repo.count({ where: { organization: { id: orgId } } });
    if (count >= sub.plan.maxBranches) {
      throw new ForbiddenException(`Límite de sucursales alcanzado según tu plan (${sub.plan.maxBranches})`);
    }
  }

  private async handleMain(branchId: number, orgId: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Branch)
      .set({ isMain: false })
      .where('organization_id = :orgId AND id != :branchId', { orgId, branchId })
      .execute();

    const existing = await this.shiftsRepo.findOne({
      where: { branch: { id: branchId }, type: ShiftType.SYSTEM, status: ShiftStatus.OPEN },
    });
    if (!existing) {
      await this.shiftsRepo.save(this.shiftsRepo.create({
        type: ShiftType.SYSTEM,
        status: ShiftStatus.OPEN,
        openingAmount: 0,
        branch: { id: branchId } as any,
        user: null,
      }));
    }
  }

  async create(dto: CreateBranchDto, orgId: number): Promise<Branch> {
    await this.checkBranchLimit(orgId);
    const branch = this.repo.create({ ...dto, organization: { id: orgId } as any });
    const saved = await this.repo.save(branch);
    if (dto.isMain) await this.handleMain(saved.id, orgId);
    return this.repo.findOne({ where: { id: saved.id }, relations: ['organization'] });
  }

  async findAll(orgId: number): Promise<Branch[]> {
    return this.repo.find({
      where: { organization: { id: orgId } },
      relations: ['organization'],
      order: { isMain: 'DESC', name: 'ASC' },
    });
  }

  async findOne(id: number, orgId: number): Promise<Branch> {
    const branch = await this.repo.findOne({
      where: { id, organization: { id: orgId } },
      relations: ['organization'],
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: number, dto: UpdateBranchDto, orgId: number): Promise<Branch> {
    const branch = await this.findOne(id, orgId);
    Object.assign(branch, dto);
    const saved = await this.repo.save(branch);
    if (dto.isMain) await this.handleMain(saved.id, orgId);
    return saved;
  }

  async remove(id: number, orgId: number): Promise<void> {
    const branch = await this.findOne(id, orgId);
    await this.repo.remove(branch);
  }
}
