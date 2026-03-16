-- ============================================================
-- Sellyx POS - Script de Base de Datos
-- PostgreSQL
-- ============================================================

-- Crear base de datos (ejecutar como superuser)
-- CREATE DATABASE sellyx;

-- ============================================================
-- TABLAS PRINCIPALES
-- ============================================================

-- Planes de suscripción
CREATE TABLE IF NOT EXISTS plans (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  description   TEXT,
  price         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  max_branches  INTEGER NOT NULL DEFAULT 1,
  max_users     INTEGER NOT NULL DEFAULT 5,
  max_products  INTEGER NOT NULL DEFAULT 100,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Organizaciones (empresas)
CREATE TABLE IF NOT EXISTS organizations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  code        VARCHAR(50) UNIQUE,            -- short slug used for tenant login scoping
  "taxId"     VARCHAR(50),
  email       VARCHAR(255),
  phone       VARCHAR(50),
  address     TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
  settings    JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
  id              SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "planId"        INTEGER NOT NULL REFERENCES plans(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'trial'
                    CHECK (status IN ('trial', 'active', 'expired', 'cancelled')),
  "startDate"     DATE NOT NULL,
  "endDate"       DATE NOT NULL,
  notes           TEXT,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sucursales
CREATE TABLE IF NOT EXISTS branches (
  id              SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  address         TEXT,
  phone           VARCHAR(50),
  "isActive"      BOOLEAN NOT NULL DEFAULT TRUE,
  "isMain"        BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Permisos
CREATE TABLE IF NOT EXISTS permissions (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

-- Roles (scoped per organization; superadmin role has organizationId = NULL)
CREATE TABLE IF NOT EXISTS roles (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  "organizationId"  INTEGER REFERENCES organizations(id) ON DELETE CASCADE
);

-- Unique: role name must be unique within an org (NULLs are distinct in Postgres, so superadmin is always unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_org ON roles(name, "organizationId") WHERE "organizationId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_system ON roles(name) WHERE "organizationId" IS NULL;

-- Relación roles <-> permisos (N:M)
CREATE TABLE IF NOT EXISTS role_permissions (
  "roleId"       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  "permissionId" INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY ("roleId", "permissionId")
);

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  "organizationId" INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  "branchId"       INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  "roleId"         INTEGER NOT NULL REFERENCES roles(id),
  username         VARCHAR(100) NOT NULL,
  password         VARCHAR(255) NOT NULL,
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255),
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "deletedAt"      TIMESTAMP
);

-- Username unique per org (NULLs are distinct in Postgres, so system users are always distinct)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_org    ON users(username, "organizationId") WHERE "organizationId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_system ON users(username)                   WHERE "organizationId" IS NULL;

-- Turnos de caja
CREATE TABLE IF NOT EXISTS shifts (
  id              SERIAL PRIMARY KEY,
  "branchId"      INTEGER NOT NULL REFERENCES branches(id),
  "userId"        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type            VARCHAR(10) NOT NULL DEFAULT 'pos'
                    CHECK (type IN ('pos', 'system')),
  status          VARCHAR(10) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
  "openingAmount" NUMERIC(10, 2) NOT NULL DEFAULT 0,
  "closingAmount" NUMERIC(10, 2),
  notes           TEXT,
  "openedAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "closedAt"      TIMESTAMP
);

-- Categorías de productos (nivel organización o sucursal)
CREATE TABLE IF NOT EXISTS categories (
  id               SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "branchId"       INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  emoji            VARCHAR(10),
  color            VARCHAR(50),
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "deletedAt"      TIMESTAMP
);

-- Productos (nivel organización o sucursal)
CREATE TABLE IF NOT EXISTS products (
  id               SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "branchId"       INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  "categoryId"     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  price            NUMERIC(10, 2) NOT NULL,
  emoji            VARCHAR(10),
  "isAvailable"    BOOLEAN NOT NULL DEFAULT TRUE,
  stock            INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "deletedAt"      TIMESTAMP
);

-- Clientes (nivel organización)
CREATE TABLE IF NOT EXISTS customers (
  id               SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255),
  phone            VARCHAR(50),
  address          TEXT,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Órdenes/ventas
CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  "branchId"       INTEGER NOT NULL REFERENCES branches(id),
  "userId"         INTEGER NOT NULL REFERENCES users(id),
  "shiftId"        INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  "customerId"     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  "orderNumber"    VARCHAR(50) NOT NULL UNIQUE,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'completed', 'cancelled')),
  "paymentMethod"  VARCHAR(20) NOT NULL DEFAULT 'cash'
                     CHECK ("paymentMethod" IN ('cash', 'card', 'transfer')),
  total            NUMERIC(10, 2) NOT NULL,
  notes            TEXT,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Items de la orden
CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  "orderId"   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "productId" INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity    INTEGER NOT NULL,
  "unitPrice" NUMERIC(10, 2) NOT NULL,
  subtotal    NUMERIC(10, 2) NOT NULL
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_org  ON subscriptions("organizationId");
CREATE INDEX IF NOT EXISTS idx_users_org          ON users("organizationId");
CREATE INDEX IF NOT EXISTS idx_users_branch       ON users("branchId");
CREATE INDEX IF NOT EXISTS idx_categories_org     ON categories("organizationId");
CREATE INDEX IF NOT EXISTS idx_categories_branch  ON categories("branchId");
CREATE INDEX IF NOT EXISTS idx_products_org       ON products("organizationId");
CREATE INDEX IF NOT EXISTS idx_products_branch    ON products("branchId");
CREATE INDEX IF NOT EXISTS idx_customers_org      ON customers("organizationId");
CREATE INDEX IF NOT EXISTS idx_orders_branch      ON orders("branchId");
CREATE INDEX IF NOT EXISTS idx_orders_shift       ON orders("shiftId");
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order  ON order_items("orderId");
CREATE INDEX IF NOT EXISTS idx_shifts_branch      ON shifts("branchId");

-- ============================================================
-- DATOS INICIALES
-- Nota: La app también siembra estos datos al iniciar por
-- primera vez (NestJS bootstrap seed). Estos INSERTs son
-- idempotentes gracias a ON CONFLICT DO NOTHING.
-- ============================================================

-- ─── Permisos ─────────────────────────────────────────────────────────────────
INSERT INTO permissions (name, description) VALUES
  -- Organización y configuración
  ('org:manage',        'Gestionar datos y configuración de la organización'),

  -- Sucursales
  ('branches:manage',   'Crear, editar y eliminar sucursales'),

  -- Usuarios
  ('users:manage',      'Crear, editar y eliminar usuarios del equipo'),

  -- Productos y categorías
  ('products:manage',   'Crear, editar, eliminar productos y categorías'),
  ('products:view',     'Ver el catálogo de productos disponibles'),

  -- Clientes
  ('customers:manage',  'Crear y editar clientes'),
  ('customers:view',    'Ver el listado de clientes'),

  -- Turnos de caja
  ('shifts:manage',     'Abrir y cerrar turnos de caja'),
  ('shifts:view',       'Ver historial de turnos de la sucursal'),

  -- Ventas y pedidos
  ('sales:create',      'Crear nuevas ventas y pedidos'),
  ('sales:view',        'Ver ventas propias y del turno actual'),
  ('orders:view_all',   'Ver pedidos de todas las sucursales y turnos'),

  -- Reportes
  ('reports:view',      'Acceder a los reportes de ventas y rentabilidad')

ON CONFLICT (name) DO NOTHING;

-- ─── Roles ────────────────────────────────────────────────────────────────────
-- Only the global superadmin role is seeded here.
-- org-specific roles (admin, cajero) are created automatically when each org is created.
INSERT INTO roles (name, description, "organizationId") VALUES
  ('superadmin', 'Propietario de la plataforma — acceso total', NULL)
ON CONFLICT DO NOTHING;

-- Rol superadmin → todos los permisos
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'superadmin' AND r."organizationId" IS NULL
ON CONFLICT DO NOTHING;
