import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('branches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  @Permissions('branches:manage')
  create(@Body() dto: CreateBranchDto, @Request() req) {
    return this.service.create(dto, req.user.orgId);
  }

  @Get()
  @Permissions('branches:manage')
  findAll(@Request() req, @Query('orgId') orgId?: string) {
    const isSuperAdmin = req.user.role === 'superadmin';
    const id = isSuperAdmin && orgId ? +orgId : req.user.orgId;
    return this.service.findAll(id);
  }

  @Get(':id')
  @Permissions('branches:manage')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(+id, req.user.orgId);
  }

  @Patch(':id')
  @Permissions('branches:manage')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto, @Request() req) {
    return this.service.update(+id, dto, req.user.orgId);
  }

  @Delete(':id')
  @Permissions('branches:manage')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(+id, req.user.orgId);
  }
}
