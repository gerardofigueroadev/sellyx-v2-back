import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Permissions('products:manage')
  create(@Body() dto: CreateCategoryDto, @Request() req) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    const branchId = (isAdmin && dto.branchId) ? dto.branchId : req.user.branchId;
    return this.categoriesService.create(dto, req.user.orgId, branchId);
  }

  @Get()
  @Permissions('products:view')
  findAll(@Request() req, @Query('branchId') branchId?: string, @Query('manage') manage?: string) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    const resolvedBranchId = isAdmin
      ? (branchId ? +branchId : undefined)
      : req.user.branchId;
    if (manage === 'true') {
      return this.categoriesService.findAllForManage(req.user.orgId, resolvedBranchId);
    }
    return this.categoriesService.findAll(req.user.orgId, resolvedBranchId);
  }

  @Get(':id')
  @Permissions('products:view')
  findOne(@Param('id') id: string, @Request() req) {
    return this.categoriesService.findOne(+id, req.user.orgId);
  }

  @Patch('reorder')
  @Permissions('products:manage')
  reorder(@Body() body: { items: { id: number; sortOrder: number }[] }, @Request() req) {
    return this.categoriesService.reorder(body.items, req.user.orgId);
  }

  @Patch(':id')
  @Permissions('products:manage')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @Request() req) {
    return this.categoriesService.update(+id, dto, req.user.orgId);
  }

  @Delete(':id')
  @Permissions('products:manage')
  remove(@Param('id') id: string, @Request() req) {
    return this.categoriesService.remove(+id, req.user.orgId);
  }
}
