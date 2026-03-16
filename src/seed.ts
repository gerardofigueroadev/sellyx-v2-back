/**
 * Seed script — limpia y recrea datos operacionales de un negocio.
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/seed.ts [orgId]
 *
 * Si no se pasa orgId, lista las organizaciones disponibles y pide elegir.
 * Borra: order_items, orders, shifts (POS), products, categories de la org.
 * Crea:  categorías y productos de ejemplo, y un turno del sistema en la sucursal principal.
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── Entities (import all so TypeORM knows the schema) ────────────────────────
import { Organization } from './organizations/entities/organization.entity';
import { Branch }       from './branches/entities/branch.entity';
import { User }         from './users/entities/user.entity';
import { Role }         from './roles/entities/role.entity';
import { Permission }   from './permissions/entities/permission.entity';
import { Category }     from './categories/entities/category.entity';
import { Product }      from './products/entities/product.entity';
import { Order }        from './orders/entities/order.entity';
import { OrderItem }    from './orders/entities/order-item.entity';
import { Shift, ShiftStatus, ShiftType } from './shifts/entities/shift.entity';
import { Customer }     from './customers/entities/customer.entity';
import { Plan }         from './subscriptions/entities/plan.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';

// ─── Sample data ──────────────────────────────────────────────────────────────
const SAMPLE_CATEGORIES = [
  { name: 'Comida',   emoji: '🍔', color: 'orange', description: 'Platos principales' },
  { name: 'Bebidas',  emoji: '🥤', color: 'blue',   description: 'Bebidas frías y calientes' },
  { name: 'Postres',  emoji: '🍰', color: 'pink',   description: 'Dulces y postres' },
];

const SAMPLE_PRODUCTS = [
  // Comida (index 0)
  { name: 'Hamburguesa Clásica',  price: 35.00, emoji: '🍔', catIdx: 0 },
  { name: 'Pizza Margherita',      price: 45.00, emoji: '🍕', catIdx: 0 },
  { name: 'Pollo a la Plancha',    price: 38.00, emoji: '🍗', catIdx: 0 },
  { name: 'Ensalada César',        price: 28.00, emoji: '🥗', catIdx: 0 },
  // Bebidas (index 1)
  { name: 'Refresco',              price: 10.00, emoji: '🥤', catIdx: 1 },
  { name: 'Jugo Natural',          price: 14.00, emoji: '🧃', catIdx: 1 },
  { name: 'Café Americano',        price: 12.00, emoji: '☕', catIdx: 1 },
  { name: 'Agua Mineral',          price:  8.00, emoji: '💧', catIdx: 1 },
  // Postres (index 2)
  { name: 'Torta de Chocolate',    price: 18.00, emoji: '🎂', catIdx: 2 },
  { name: 'Helado 2 bolas',        price: 15.00, emoji: '🍦', catIdx: 2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function hr() { console.log('─'.repeat(60)); }

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     +(process.env.DB_PORT   ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '12345678',
    database: process.env.DB_DATABASE ?? 'consuelito',
    entities: [Organization, Branch, User, Role, Permission, Category, Product,
               Order, OrderItem, Shift, Customer, Plan, Subscription],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log('\n✅  Conectado a la base de datos\n');

  // ── 1. Elegir organización ────────────────────────────────────────────────
  const orgs = await ds.getRepository(Organization).find({ order: { name: 'ASC' } });
  if (orgs.length === 0) { console.log('❌  No hay organizaciones en la BD.'); await ds.destroy(); return; }

  hr();
  console.log('ORGANIZACIONES DISPONIBLES:');
  orgs.forEach((o, i) => console.log(`  [${i + 1}] ${o.name}  (id=${o.id})`));
  hr();

  let orgId = parseInt(process.argv[2]);
  if (!orgId) {
    const choice = await ask('Elige el número de organización: ');
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || !orgs[idx]) { console.log('❌  Selección inválida'); await ds.destroy(); return; }
    orgId = orgs[idx].id;
  }

  const org = orgs.find(o => o.id === orgId);
  if (!org) { console.log(`❌  Organización ${orgId} no encontrada`); await ds.destroy(); return; }

  // ── 2. Elegir sucursal ────────────────────────────────────────────────────
  const branches = await ds.getRepository(Branch).find({
    where: { organization: { id: orgId } },
    order: { isMain: 'DESC', name: 'ASC' },
  });

  if (branches.length === 0) { console.log('❌  La organización no tiene sucursales.'); await ds.destroy(); return; }

  hr();
  console.log(`SUCURSALES de "${org.name}":`);
  branches.forEach((b, i) => console.log(`  [${i + 1}] ${b.name}${b.isMain ? ' ⭐ principal' : ''}  (id=${b.id})`));
  console.log(`  [0] Todas las sucursales`);
  hr();

  const bChoice = await ask('Elige sucursal (0 para todas): ');
  const bIdx = parseInt(bChoice);
  let targetBranchIds: number[];

  if (bIdx === 0) {
    targetBranchIds = branches.map(b => b.id);
  } else {
    const b = branches[bIdx - 1];
    if (!b) { console.log('❌  Selección inválida'); await ds.destroy(); return; }
    targetBranchIds = [b.id];
  }

  // ── 3. Confirmar ──────────────────────────────────────────────────────────
  hr();
  console.log(`⚠️   ADVERTENCIA: Se eliminarán todos los datos operacionales de:`);
  console.log(`     Org: ${org.name}`);
  console.log(`     Sucursal(es): ${targetBranchIds.map(id => branches.find(b => b.id === id)?.name).join(', ')}`);
  console.log(`     (pedidos, turnos POS, productos, categorías)`);
  hr();
  const confirm = await ask('¿Confirmar? Escribe "si" para continuar: ');
  if (confirm.toLowerCase() !== 'si') { console.log('❌  Cancelado'); await ds.destroy(); return; }

  // ── 4. Limpiar datos operacionales ────────────────────────────────────────
  console.log('\n🗑️   Limpiando datos...');

  for (const branchId of targetBranchIds) {
    // Eliminar order_items via orders de la sucursal
    await ds.query(`
      DELETE FROM order_items WHERE "orderId" IN (
        SELECT id FROM orders WHERE "branchId" = $1
      )
    `, [branchId]);

    await ds.query(`DELETE FROM orders WHERE "branchId" = $1`, [branchId]);

    // Solo eliminar turnos POS (no el turno del sistema)
    await ds.query(`
      DELETE FROM shifts WHERE "branchId" = $1 AND type = 'pos'
    `, [branchId]);

    // Soft-delete productos de la sucursal (o globales de la org si es sucursal única)
    if (targetBranchIds.length === 1 && branches.length === 1) {
      await ds.query(`
        UPDATE products SET "deletedAt" = NOW()
        WHERE "organizationId" = $1 AND ("branchId" = $2 OR "branchId" IS NULL)
      `, [orgId, branchId]);
    } else {
      await ds.query(`
        UPDATE products SET "deletedAt" = NOW()
        WHERE "branchId" = $1
      `, [branchId]);
    }

    // Soft-delete categorías de la sucursal
    if (targetBranchIds.length === 1 && branches.length === 1) {
      await ds.query(`
        UPDATE categories SET "deletedAt" = NOW()
        WHERE "organizationId" = $1 AND ("branchId" = $2 OR "branchId" IS NULL)
      `, [orgId, branchId]);
    } else {
      await ds.query(`
        UPDATE categories SET "deletedAt" = NOW()
        WHERE "branchId" = $1
      `, [branchId]);
    }
  }
  console.log('✅  Datos limpios\n');

  // ── 5. Crear datos de ejemplo ─────────────────────────────────────────────
  const wantSample = await ask('¿Crear categorías y productos de ejemplo? (si/no): ');
  if (wantSample.toLowerCase() === 'si') {

    let seedBranchId: number | null = null;
    if (targetBranchIds.length === 1) {
      seedBranchId = targetBranchIds[0];
    } else {
      // Elegir en qué sucursal crear los ejemplos
      hr();
      branches.forEach((b, i) => console.log(`  [${i + 1}] ${b.name}`));
      const sbChoice = await ask('¿En qué sucursal crear los productos ejemplo? (número): ');
      const sb = branches[parseInt(sbChoice) - 1];
      if (sb) seedBranchId = sb.id;
    }

    console.log('\n📦  Creando categorías...');
    const createdCats: Category[] = [];
    for (const c of SAMPLE_CATEGORIES) {
      const cat = ds.getRepository(Category).create({
        name: c.name, emoji: c.emoji, color: c.color,
        description: c.description, isActive: true,
        organization: { id: orgId } as any,
        branch: seedBranchId ? { id: seedBranchId } as any : null,
      });
      createdCats.push(await ds.getRepository(Category).save(cat));
      console.log(`  ✓ ${c.emoji} ${c.name}`);
    }

    console.log('\n🛒  Creando productos...');
    for (const p of SAMPLE_PRODUCTS) {
      const prod = ds.getRepository(Product).create({
        name: p.name, price: p.price, emoji: p.emoji,
        isAvailable: true, stock: 0,
        category: createdCats[p.catIdx],
        organization: { id: orgId } as any,
        branch: seedBranchId ? { id: seedBranchId } as any : null,
      });
      await ds.getRepository(Product).save(prod);
      console.log(`  ✓ ${p.emoji} ${p.name} — Bs. ${p.price.toFixed(2)}`);
    }
  }

  // ── 6. Garantizar turno del sistema en sucursal principal ─────────────────
  const mainBranch = branches.find(b => b.isMain) ?? branches[0];
  const sysShift = await ds.getRepository(Shift).findOne({
    where: { branch: { id: mainBranch.id }, type: ShiftType.SYSTEM, status: ShiftStatus.OPEN },
  });
  if (!sysShift) {
    const shift = ds.getRepository(Shift).create({
      type: ShiftType.SYSTEM, status: ShiftStatus.OPEN,
      openingAmount: 0,
      branch: { id: mainBranch.id } as any,
      user: null,
    });
    await ds.getRepository(Shift).save(shift);
    console.log(`\n⚙️   Turno del sistema creado para "${mainBranch.name}"`);
  } else {
    console.log(`\n⚙️   Turno del sistema ya existe en "${mainBranch.name}"`);
  }

  hr();
  console.log('🎉  ¡Seed completado exitosamente!');
  hr();
  await ds.destroy();
}

main().catch(e => { console.error('❌  Error en seed:', e.message); process.exit(1); });
