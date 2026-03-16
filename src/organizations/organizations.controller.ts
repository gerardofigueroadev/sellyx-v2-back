import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Post()
  @Permissions('org:manage')
  create(@Body() dto: CreateOrganizationDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('org:manage')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions('org:manage')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(+id, req.user.orgId);
  }

  @Patch(':id')
  @Permissions('org:manage')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto, @Request() req) {
    return this.service.update(+id, dto, req.user.orgId);
  }

  @Delete(':id')
  @Permissions('org:manage')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(+id, req.user.orgId);
  }

  @Get('my/settings')
  @Permissions('org:manage')
  getSettings(@Request() req) {
    return this.service.getSettings(req.user.orgId);
  }

  @Patch('my/settings')
  @Permissions('org:manage')
  updateSettings(@Body() body: Record<string, any>, @Request() req) {
    return this.service.updateSettings(req.user.orgId, body);
  }
}
