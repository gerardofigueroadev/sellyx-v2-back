import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @Permissions('users:manage')
  findAll(@Request() req) {
    return this.service.findAll(req.user.orgId);
  }

  @Get(':id')
  @Permissions('users:manage')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(+id, req.user.orgId);
  }

  @Post()
  @Permissions('users:manage')
  create(@Body() dto: CreateRoleDto, @Request() req) {
    return this.service.createRole(dto, req.user.orgId);
  }

  @Patch(':id')
  @Permissions('users:manage')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Request() req) {
    return this.service.updateRole(+id, dto, req.user.orgId);
  }

  @Delete(':id')
  @Permissions('users:manage')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.removeRole(+id, req.user.orgId);
  }
}
