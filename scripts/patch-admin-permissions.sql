-- ─────────────────────────────────────────────────────────────────────────────
-- patch-admin-permissions.sql
--
-- Agrega permisos faltantes al rol "admin" de todas las organizaciones.
-- Ejecutar en el SQL Editor de Neon (o cualquier cliente PostgreSQL).
-- Es idempotente: no duplica permisos ya asignados.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ver el estado actual (informativo, no modifica nada)
SELECT
  r.id         AS "roleId",
  r.name       AS "role",
  o.name       AS "organización",
  p.name       AS "permiso",
  CASE WHEN rp."roleId" IS NOT NULL THEN '✓' ELSE '✗ FALTA' END AS "asignado"
FROM roles r
JOIN organizations o ON o.id = r."organizationId"
CROSS JOIN permissions p
LEFT JOIN role_permissions rp ON rp."roleId" = r.id AND rp."permissionId" = p.id
WHERE r.name = 'admin'
ORDER BY o.name, p.name;

-- 2. Insertar permisos faltantes en todos los roles "admin"
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- 3. Confirmar resultado
SELECT
  o.name        AS "organización",
  COUNT(rp.*)   AS "permisos_asignados"
FROM roles r
JOIN organizations o        ON o.id = r."organizationId"
JOIN role_permissions rp    ON rp."roleId" = r.id
WHERE r.name = 'admin'
GROUP BY o.name
ORDER BY o.name;
