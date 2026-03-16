import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { RolesService } from '../roles/roles.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private repo: Repository<Organization>,
    private rolesService: RolesService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  private generateCode(name: string): string {
    const slug = name.toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]/g, '').slice(0, 20);
    return slug || `org${Date.now()}`;
  }

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    const code = dto.code?.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
      || this.generateCode(dto.name);
    const org = await this.repo.save(this.repo.create({ ...dto, code }));
    // Seed default roles and trial subscription for the new org
    await this.rolesService.seed(org.id);
    await this.subscriptionsService.seedTrial(org.id);
    return org;
  }

  async findAll(): Promise<Organization[]> {
    return this.repo.find();
  }

  async findOne(id: number, orgId: number): Promise<Organization> {
    if (id !== orgId) throw new ForbiddenException('Access denied');
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: number, dto: UpdateOrganizationDto, orgId: number): Promise<Organization> {
    const org = await this.findOne(id, orgId);
    Object.assign(org, dto);
    return this.repo.save(org);
  }

  async remove(id: number, orgId: number): Promise<void> {
    const org = await this.findOne(id, orgId);
    await this.repo.remove(org);
  }

  async getSettings(orgId: number): Promise<Record<string, any>> {
    const org = await this.repo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    return org.settings ?? {};
  }

  async updateSettings(orgId: number, patch: Record<string, any>): Promise<Record<string, any>> {
    const org = await this.repo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    org.settings = { ...(org.settings ?? {}), ...patch };
    await this.repo.save(org);
    return org.settings;
  }
}
