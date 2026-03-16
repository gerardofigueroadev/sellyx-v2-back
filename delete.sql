DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM shifts;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM users WHERE "roleId" != (SELECT id FROM roles WHERE name = 'superadmin');
UPDATE users SET "organizationId" = NULL, "branchId" = NULL WHERE "roleId" = (SELECT id FROM roles WHERE name = 'superadmin');
DELETE FROM branches;
DELETE FROM organizations;