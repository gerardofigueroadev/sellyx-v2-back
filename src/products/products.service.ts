import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Subscription } from '../subscriptions/entities/subscription.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Subscription)
    private subsRepo: Repository<Subscription>,
  ) {}

  private async checkProductLimit(orgId: number): Promise<void> {
    const sub = await this.subsRepo.findOne({
      where: { organization: { id: orgId } },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
    if (!sub || sub.plan.maxProducts === -1) return;
    const count = await this.productsRepository.count({ where: { organization: { id: orgId } } });
    if (count >= sub.plan.maxProducts) {
      throw new ForbiddenException(`Límite de productos alcanzado según tu plan (${sub.plan.maxProducts})`);
    }
  }

  async create(dto: CreateProductDto, orgId: number, branchId?: number): Promise<Product> {
    await this.checkProductLimit(orgId);
    const product = this.productsRepository.create({
      ...dto,
      category: { id: dto.categoryId } as any,
      organization: { id: orgId } as any,
      branch: branchId ? { id: branchId } as any : null,
    });
    return this.productsRepository.save(product);
  }

  async findAll(orgId: number, branchId?: number): Promise<Product[]> {
    if (branchId) {
      return this.productsRepository.find({
        where: [
          { organization: { id: orgId }, branch: { id: branchId } },
          { organization: { id: orgId }, branch: IsNull() },
        ],
        relations: ['category', 'organization', 'branch'],
        order: { name: 'ASC' },
      });
    }
    return this.productsRepository.find({
      where: { organization: { id: orgId } },
      relations: ['category', 'organization', 'branch'],
      order: { name: 'ASC' },
    });
  }

  async findAvailable(orgId: number, branchId?: number): Promise<Product[]> {
    if (branchId) {
      return this.productsRepository.find({
        where: [
          { isAvailable: true, organization: { id: orgId }, branch: { id: branchId } },
          { isAvailable: true, organization: { id: orgId }, branch: IsNull() },
        ],
        relations: ['category'],
      });
    }
    return this.productsRepository.find({
      where: { isAvailable: true, organization: { id: orgId } },
      relations: ['category'],
    });
  }

  async findOne(id: number, orgId: number): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id, organization: { id: orgId } },
      relations: ['category', 'organization', 'branch'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: number, dto: UpdateProductDto, orgId: number): Promise<Product> {
    const product = await this.findOne(id, orgId);
    if (dto.categoryId) (product as any).category = { id: dto.categoryId };
    if ('branchId' in dto) {
      (product as any).branch = (dto as any).branchId ? { id: (dto as any).branchId } : null;
    }
    Object.assign(product, dto);
    return this.productsRepository.save(product);
  }

  async remove(id: number, orgId: number): Promise<void> {
    const product = await this.findOne(id, orgId);
    await this.productsRepository.softRemove(product);
  }

  async copyToBranch(sourceBranchId: number, targetBranchId: number, orgId: number): Promise<{ copied: number; skipped: number }> {
    if (sourceBranchId === targetBranchId) {
      throw new BadRequestException('La sucursal de origen y destino deben ser diferentes');
    }

    const sourceProducts = await this.productsRepository.find({
      where: [
        { organization: { id: orgId }, branch: { id: sourceBranchId } },
        { organization: { id: orgId }, branch: IsNull() },
      ],
      relations: ['category'],
    });

    const existing = await this.productsRepository.find({
      where: { organization: { id: orgId }, branch: { id: targetBranchId } },
      select: ['name'],
    });
    const existingNames = new Set(existing.map(p => p.name.toLowerCase().trim()));

    let copied = 0;
    let skipped = 0;

    for (const src of sourceProducts) {
      if (existingNames.has(src.name.toLowerCase().trim())) { skipped++; continue; }
      await this.productsRepository.save(this.productsRepository.create({
        name: src.name,
        description: src.description,
        price: src.price,
        emoji: src.emoji,
        isAvailable: src.isAvailable,
        stock: 0,
        category: src.category,
        organization: { id: orgId } as any,
        branch: { id: targetBranchId } as any,
      }));
      copied++;
    }

    return { copied, skipped };
  }
}
