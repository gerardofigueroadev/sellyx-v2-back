import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('users:manage')
  create(@Body() dto: CreateUserDto, @Request() req) {
    const isSuperAdmin = req.user.role === 'superadmin';
    const orgId = isSuperAdmin && dto.organizationId ? dto.organizationId : req.user.orgId;
    return this.usersService.create(dto, orgId);
  }

  @Get()
  @Permissions('users:manage')
  findAll(@Request() req, @Query('orgId') orgId?: string) {
    const isSuperAdmin = req.user.role === 'superadmin';
    const id = isSuperAdmin && orgId ? +orgId : req.user.orgId;
    return this.usersService.findAll(id);
  }

  @Get(':id')
  @Permissions('users:manage')
  findOne(@Param('id') id: string, @Request() req) {
    return this.usersService.findOne(+id, req.user.orgId);
  }

  @Patch(':id')
  @Permissions('users:manage')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
    return this.usersService.update(+id, dto, req.user.orgId);
  }

  @Delete(':id')
  @Permissions('users:manage')
  remove(@Param('id') id: string, @Request() req) {
    return this.usersService.remove(+id, req.user.orgId);
  }
}
