/**
 * patch-permissions.ts
 *
 * Asegura que todos los roles "admin" tengan los permisos definidos en ADMIN_PERMS.
 * Útil cuando se agregan nuevos permisos al sistema sin resetear la BD.
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/patch-permissions.ts
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { Organization } from './organizations/entities/organization.entity';
import { Branch }       from './branches/entities/branch.entity';
import { User }         from './users/entities/user.entity';
import { Role }         from './roles/entities/role.entity';
import { Permission }   from './permissions/entities/permission.entity';
import { Category }     from './categories/entities/category.entity';
import { Product }      from './products/entities/product.entity';
import { Order }        from './orders/entities/order.entity';
import { OrderItem }    from './orders/entities/order-item.entity';
import { Shift }        from './shifts/entities/shift.entity';
import { Customer }     from './customers/entities/customer.entity';
import { Plan }         from './subscriptions/entities/plan.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';

// Permisos que debe tener el rol admin (fuente de verdad)
const ADMIN_PERMS = [
  'org:manage', 'branches:manage', 'users:manage',
  'products:manage', 'products:view',
  'customers:manage', 'customers:view',
  'shifts:manage', 'shifts:view',
  'sales:create', 'sales:view',
  'orders:view_all', 'orders:void', 'reports:view',
];

function hr() { console.log('─'.repeat(60)); }

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     +(process.env.DB_PORT   ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '12345678',
    database: process.env.DB_DATABASE ?? 'consuelito',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: [Organization, Branch, User, Role, Permission, Category, Product,
               Order, OrderItem, Shift, Customer, Plan, Subscription],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log('\n✅  Conectado a la base de datos\n');

  const permRepo = ds.getRepository(Permission);
  const roleRepo = ds.getRepository(Role);

  // 1. Garantizar que todos los permisos existan en la tabla
  hr();
  console.log('1/2  Verificando tabla de permisos...');
  const allPerms = await permRepo.find();
  const existingNames = new Set(allPerms.map(p => p.name));

  const missing = [
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
    { name: 'orders:void',       description: 'Anular ventas completadas (requiere flag de organización)' },
    { name: 'reports:view',      description: 'Acceder a los reportes de ventas y rentabilidad' },
  ].filter(d => !existingNames.has(d.name));

  if (missing.length > 0) {
    await permRepo.save(missing.map(p => permRepo.create(p)));
    console.log(`  ✓ Permisos creados: ${missing.map(p => p.name).join(', ')}`);
  } else {
    console.log('  ✓ Todos los permisos ya existen');
  }

  // 2. Actualizar roles admin con los permisos faltantes
  hr();
  console.log('2/2  Parcheando roles admin...\n');

  const updatedPerms = await permRepo.find();
  const adminPermsEntities = updatedPerms.filter(p => ADMIN_PERMS.includes(p.name));

  const adminRoles = await roleRepo.find({
    where: { name: 'admin' },
    relations: ['permissions', 'organization'],
  });

  if (adminRoles.length === 0) {
    console.log('  ⚠️  No se encontraron roles admin');
    await ds.destroy(); return;
  }

  for (const role of adminRoles) {
    const currentNames = new Set(role.permissions.map(p => p.name));
    const toAdd = adminPermsEntities.filter(p => !currentNames.has(p.name));

    if (toAdd.length === 0) {
      console.log(`  ✓ [${role.organization?.name ?? 'sistema'}] Ya tiene todos los permisos`);
      continue;
    }

    role.permissions = [...role.permissions, ...toAdd];
    await roleRepo.save(role);
    console.log(`  ✓ [${role.organization?.name ?? 'sistema'}] Agregados: ${toAdd.map(p => p.name).join(', ')}`);
  }

  hr();
  console.log('🎉  ¡Patch completado! Los usuarios deben cerrar sesión y volver a entrar.');
  hr();
  await ds.destroy();
}

main().catch(e => { console.error('❌  Error:', e.message); process.exit(1); });
