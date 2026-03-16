import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Permissions('products:manage')
  create(@Body() dto: CreateProductDto, @Request() req) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    const branchId = (isAdmin && dto.branchId) ? dto.branchId : req.user.branchId;
    return this.productsService.create(dto, req.user.orgId, branchId);
  }

  @Get()
  @Permissions('products:view')
  findAll(@Request() req, @Query('branchId') branchId?: string) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    const resolvedBranchId = isAdmin
      ? (branchId ? +branchId : undefined)
      : req.user.branchId;
    return this.productsService.findAll(req.user.orgId, resolvedBranchId);
  }

  @Get('available')
  @Permissions('products:view')
  findAvailable(@Request() req, @Query('branchId') branchId?: string) {
    const isAdmin = req.user.permissions.includes('orders:view_all');
    const resolvedBranchId = isAdmin
      ? (branchId ? +branchId : undefined)
      : req.user.branchId;
    return this.productsService.findAvailable(req.user.orgId, resolvedBranchId);
  }

  @Post('copy-to-branch')
  @Permissions('products:manage')
  copyToBranch(
    @Body() dto: { sourceBranchId: number; targetBranchId: number },
    @Request() req,
  ) {
    return this.productsService.copyToBranch(dto.sourceBranchId, dto.targetBranchId, req.user.orgId);
  }

  @Get(':id')
  @Permissions('products:view')
  findOne(@Param('id') id: string, @Request() req) {
    return this.productsService.findOne(+id, req.user.orgId);
  }

  @Patch(':id')
  @Permissions('products:manage')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Request() req) {
    return this.productsService.update(+id, dto, req.user.orgId);
  }

  @Delete(':id')
  @Permissions('products:manage')
  remove(@Param('id') id: string, @Request() req) {
    return this.productsService.remove(+id, req.user.orgId);
  }
}
