import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  private async countActive(orgId: number, branchId?: number): Promise<number> {
    if (branchId) {
      return this.categoriesRepository.count({
        where: [
          { isActive: true, organization: { id: orgId }, branch: { id: branchId } },
          { isActive: true, organization: { id: orgId }, branch: IsNull() },
        ],
      });
    }
    return this.categoriesRepository.count({
      where: { isActive: true, organization: { id: orgId } },
    });
  }

  private async nextSortOrder(orgId: number): Promise<number> {
    const result = await this.categoriesRepository
      .createQueryBuilder('c')
      .select('MAX(c.sortOrder)', 'max')
      .where('c.organizationId = :orgId', { orgId })
      .getRawOne();
    return (result?.max ?? 0) + 1;
  }

  async create(dto: CreateCategoryDto, orgId: number, branchId?: number): Promise<Category> {
    if (dto.isActive !== false) {
      const active = await this.countActive(orgId, branchId);
      if (active >= 3) throw new BadRequestException('Solo se permiten 3 categorías activas a la vez');
    }
    const sortOrder = await this.nextSortOrder(orgId);
    const category = this.categoriesRepository.create({
      ...dto,
      sortOrder,
      organization: { id: orgId } as any,
      branch: branchId ? { id: branchId } as any : null,
    });
    return this.categoriesRepository.save(category);
  }

  async findAll(orgId: number, branchId?: number): Promise<Category[]> {
    if (branchId) {
      return this.categoriesRepository.find({
        where: [
          { isActive: true, organization: { id: orgId }, branch: { id: branchId } },
          { isActive: true, organization: { id: orgId }, branch: IsNull() },
        ],
        relations: ['organization', 'branch'],
        order: { sortOrder: 'ASC' },
      });
    }
    return this.categoriesRepository.find({
      where: { isActive: true, organization: { id: orgId } },
      relations: ['organization', 'branch'],
      order: { sortOrder: 'ASC' },
    });
  }

  async findAllForManage(orgId: number, branchId?: number): Promise<Category[]> {
    if (branchId) {
      return this.categoriesRepository.find({
        where: [
          { organization: { id: orgId }, branch: { id: branchId } },
          { organization: { id: orgId }, branch: IsNull() },
        ],
        relations: ['organization', 'branch', 'products'],
        order: { sortOrder: 'ASC' },
      });
    }
    return this.categoriesRepository.find({
      where: { organization: { id: orgId } },
      relations: ['organization', 'branch', 'products'],
      order: { sortOrder: 'ASC' },
    });
  }

  async findOne(id: number, orgId: number): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id, organization: { id: orgId } },
      relations: ['branch'],
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: number, dto: UpdateCategoryDto, orgId: number): Promise<Category> {
    const category = await this.findOne(id, orgId);
    if (dto.isActive === true && !category.isActive) {
      const active = await this.countActive(orgId, category.branch?.id);
      if (active >= 3) throw new BadRequestException('Solo se permiten 3 categorías activas a la vez');
    }
    if ('branchId' in dto) {
      (category as any).branch = (dto as any).branchId ? { id: (dto as any).branchId } : null;
    }
    Object.assign(category, dto);
    return this.categoriesRepository.save(category);
  }

  async reorder(items: { id: number; sortOrder: number }[], orgId: number): Promise<void> {
    for (const item of items) {
      await this.categoriesRepository.update(
        { id: item.id, organization: { id: orgId } },
        { sortOrder: item.sortOrder },
      );
    }
  }

  async remove(id: number, orgId: number): Promise<void> {
    const category = await this.findOne(id, orgId);
    await this.categoriesRepository.softRemove(category);
  }
}
