import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsNull } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ADMIN_PERMS = [
  'org:manage', 'branches:manage', 'users:manage',
  'products:manage', 'products:view',
  'customers:manage', 'customers:view',
  'shifts:manage', 'shifts:view',
  'sales:create', 'sales:view',
  'orders:view_all', 'reports:view',
];

const CAJERO_PERMS = [
  'products:view', 'customers:view',
  'shifts:manage', 'shifts:view',
  'sales:create', 'sales:view',
];

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionsRepo: Repository<Permission>,
  ) {}

  /** Seed default roles for a specific organization. Idempotent. */
  async seed(orgId: number): Promise<void> {
    const existing = await this.rolesRepo.findOne({
      where: { name: 'admin', organizationId: orgId },
    });
    if (existing) return;

    const allPermissions = await this.permissionsRepo.find();
    const getPerms = (...names: string[]) => allPermissions.filter(p => names.includes(p.name));

    await this.rolesRepo.save([
      this.rolesRepo.create({
        name: 'admin',
        description: 'Administrador con acceso completo a la empresa',
        organization: { id: orgId } as any,
        permissions: getPerms(...ADMIN_PERMS),
      }),
      this.rolesRepo.create({
        name: 'cajero',
        description: 'Cajero con acceso al módulo de ventas de su sucursal',
        organization: { id: orgId } as any,
        permissions: getPerms(...CAJERO_PERMS),
      }),
    ]);
    console.log(`✓ Roles creados para organización #${orgId}`);
  }

  /** Seed the global superadmin role (no org). Idempotent. */
  async seedSuperAdmin(): Promise<void> {
    const exists = await this.rolesRepo.findOne({ where: { name: 'superadmin', organizationId: IsNull() } });
    if (exists) return;

    const allPermissions = await this.permissionsRepo.find();
    await this.rolesRepo.save(
      this.rolesRepo.create({
        name: 'superadmin',
        description: 'Propietario de la plataforma — acceso total',
        organization: null,
        permissions: allPermissions,
      }),
    );
    console.log('✓ Rol superadmin creado');
  }

  /** Seed permissions. Idempotent (skips if already exist). */
  async seedPermissions(): Promise<void> {
    const count = await this.permissionsRepo.count();
    if (count > 0) return;

    await this.permissionsRepo.save([
      { name: 'org:manage',        description: 'Gestionar datos y configuración de la organización' },
      { name: 'branches:manage',   description: 'Crear, editar y eliminar sucursales' },
      { name: 'users:manage',      description: 'Crear, editar y eliminar usuarios del equipo' },
      { name: 'products:manage',   description: 'Crear, editar, eliminar productos y categorías' },
      { name: 'products:view',     description: 'Ver el catálogo de productos disponibles' },
      { name: 'customers:manage',  description: 'Crear y editar clientes' },
      { name: 'customers:view',    description: 'Ver el listado de clientes' },
      { name: 'shifts:manage',     description: 'Abrir y cerrar turnos de caja' },
      { name: 'shifts:view',       description: 'Ver historial de turnos de la sucursal' },
      { name: 'sales:create',      description: 'Crear nuevas ventas y pedidos' },
      { name: 'sales:view',        description: 'Ver ventas propias y del turno actual' },
      { name: 'orders:view_all',   description: 'Ver pedidos de todas las sucursales y turnos' },
      { name: 'reports:view',      description: 'Acceder a los reportes de ventas y rentabilidad' },
    ].map(p => this.permissionsRepo.create(p)));
    console.log('✓ Permisos creados');
  }

  findAll(orgId: number): Promise<Role[]> {
    return this.rolesRepo.find({
      where: { organizationId: orgId },
      relations: ['permissions'],
    });
  }

  async findOne(id: number, orgId?: number): Promise<Role> {
    const where: any = { id };
    if (orgId !== undefined) where.organizationId = orgId;
    const role = await this.rolesRepo.findOne({ where, relations: ['permissions'] });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findByName(name: string, orgId?: number): Promise<Role | null> {
    const where: any = { name };
    if (orgId !== undefined) where.organizationId = orgId ?? IsNull();
    else where.organizationId = IsNull(); // default: system role
    return this.rolesRepo.findOne({ where, relations: ['permissions'] });
  }

  async updatePermissions(id: number, permissionIds: number[], orgId: number): Promise<Role> {
    const role = await this.findOne(id, orgId);
    if (role.name === 'admin' || role.name === 'superadmin') {
      throw new BadRequestException(`El rol "${role.name}" no puede ser modificado`);
    }
    const permissions = await this.permissionsRepo.findByIds(permissionIds);
    role.permissions = permissions;
    return this.rolesRepo.save(role);
  }

  async createRole(dto: CreateRoleDto, orgId: number): Promise<Role> {
    const existing = await this.rolesRepo.findOne({ where: { name: dto.name, organizationId: orgId } });
    if (existing) throw new ConflictException(`Ya existe un rol con el nombre "${dto.name}"`);
    const permissions = dto.permissionIds?.length
      ? await this.permissionsRepo.findByIds(dto.permissionIds)
      : [];
    return this.rolesRepo.save(this.rolesRepo.create({
      name: dto.name,
      description: dto.description,
      organization: { id: orgId } as any,
      permissions,
    }));
  }

  async updateRole(id: number, dto: UpdateRoleDto, orgId: number): Promise<Role> {
    const role = await this.findOne(id, orgId);
    if (role.name === 'admin' || role.name === 'superadmin') {
      throw new BadRequestException(`El rol "${role.name}" no puede ser renombrado`);
    }
    if (dto.name !== undefined) {
      const conflict = await this.rolesRepo.findOne({ where: { name: dto.name, organizationId: orgId } });
      if (conflict && conflict.id !== id) throw new ConflictException(`Ya existe un rol con el nombre "${dto.name}"`);
      role.name = dto.name;
    }
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.permissionIds !== undefined) {
      role.permissions = await this.permissionsRepo.findByIds(dto.permissionIds);
    }
    return this.rolesRepo.save(role);
  }

  async removeRole(id: number, orgId: number): Promise<void> {
    const role = await this.findOne(id, orgId);
    if (role.name === 'admin' || role.name === 'superadmin') {
      throw new BadRequestException(`El rol "${role.name}" no puede ser eliminado`);
    }
    await this.rolesRepo.remove(role);
  }
}
