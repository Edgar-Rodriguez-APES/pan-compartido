const { createTenantQuery } = require('../utils/tenantQuery');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const db = require('../config/database');

describe('Multi-Tenant Data Isolation', () => {
  let tenant1, tenant2;
  let tenantQuery1, tenantQuery2;

  beforeAll(async () => {
    // Crear dos tenants de prueba
    tenant1 = await Tenant.create({
      name: 'Test Tenant 1',
      slug: 'test-tenant-1',
      branding: { colors: { primary: '#000000' } }
    });

    tenant2 = await Tenant.create({
      name: 'Test Tenant 2',
      slug: 'test-tenant-2',
      branding: { colors: { primary: '#ffffff' } }
    });

    // Crear instancias de TenantQuery para cada tenant
    tenantQuery1 = createTenantQuery(tenant1.id);
    tenantQuery2 = createTenantQuery(tenant2.id);
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await db('users').where('tenant_id', tenant1.id).del();
    await db('users').where('tenant_id', tenant2.id).del();
    await db('tenants').where('id', tenant1.id).del();
    await db('tenants').where('id', tenant2.id).del();
  });

  describe('TenantQuery Utility', () => {
    test('should create TenantQuery instance with valid tenant ID', () => {
      expect(tenantQuery1).toBeDefined();
      expect(tenantQuery1.tenantId).toBe(tenant1.id);
    });

    test('should throw error when creating TenantQuery without tenant ID', () => {
      expect(() => createTenantQuery()).toThrow('Tenant ID es requerido para crear TenantQuery');
    });

    test('should automatically add tenant_id to insert operations', async () => {
      const userData = {
        name: 'Test User 1',
        email: 'test1@example.com',
        phone: '3001234567',
        password_hash: 'hashedpassword',
        role: 'feligres'
      };

      await tenantQuery1.insert('users', userData);

      // Verificar que el usuario fue creado con el tenant_id correcto
      const user = await db('users')
        .where('email', 'test1@example.com')
        .first();

      expect(user).toBeDefined();
      expect(user.tenant_id).toBe(tenant1.id);
      expect(user.name).toBe('Test User 1');
    });

    test('should isolate data by tenant in table queries', async () => {
      // Crear usuarios en ambos tenants
      await tenantQuery1.insert('users', {
        name: 'User Tenant 1',
        email: 'user1@tenant1.com',
        phone: '3001111111',
        password_hash: 'hash1',
        role: 'feligres'
      });

      await tenantQuery2.insert('users', {
        name: 'User Tenant 2',
        email: 'user2@tenant2.com',
        phone: '3002222222',
        password_hash: 'hash2',
        role: 'feligres'
      });

      // Verificar que cada tenant solo ve sus propios usuarios
      const tenant1Users = await tenantQuery1.table('users').select('*');
      const tenant2Users = await tenantQuery2.table('users').select('*');

      expect(tenant1Users.length).toBeGreaterThan(0);
      expect(tenant2Users.length).toBeGreaterThan(0);

      // Verificar que no hay cruce de datos
      tenant1Users.forEach(user => {
        expect(user.tenant_id).toBe(tenant1.id);
      });

      tenant2Users.forEach(user => {
        expect(user.tenant_id).toBe(tenant2.id);
      });

      // Verificar que los usuarios específicos están en el tenant correcto
      const tenant1UserEmails = tenant1Users.map(u => u.email);
      const tenant2UserEmails = tenant2Users.map(u => u.email);

      expect(tenant1UserEmails).toContain('user1@tenant1.com');
      expect(tenant1UserEmails).not.toContain('user2@tenant2.com');

      expect(tenant2UserEmails).toContain('user2@tenant2.com');
      expect(tenant2UserEmails).not.toContain('user1@tenant1.com');
    });

    test('should handle global tables without tenant_id', async () => {
      // Las tablas de productos son globales (sin tenant_id)
      const products = await tenantQuery1.table('products').select('*');
      const products2 = await tenantQuery2.table('products').select('*');

      // Ambos tenants deberían ver los mismos productos
      expect(products).toEqual(products2);
    });

    test('should validate ownership correctly', async () => {
      // Crear un usuario en tenant1
      const [user] = await tenantQuery1.insert('users', {
        name: 'Ownership Test User',
        email: 'ownership@test.com',
        phone: '3003333333',
        password_hash: 'hash',
        role: 'feligres'
      }).returning('*');

      // Tenant1 debería poder validar ownership
      const isOwner1 = await tenantQuery1.validateOwnership('users', user.id);
      expect(isOwner1).toBe(true);

      // Tenant2 NO debería poder validar ownership
      const isOwner2 = await tenantQuery2.validateOwnership('users', user.id);
      expect(isOwner2).toBe(false);
    });

    test('should count records correctly per tenant', async () => {
      // Contar usuarios antes
      const initialCount1 = await tenantQuery1.count('users');
      const initialCount2 = await tenantQuery2.count('users');

      // Agregar un usuario a tenant1
      await tenantQuery1.insert('users', {
        name: 'Count Test User',
        email: 'count@test.com',
        phone: '3004444444',
        password_hash: 'hash',
        role: 'feligres'
      });

      // Verificar que solo el count de tenant1 aumentó
      const newCount1 = await tenantQuery1.count('users');
      const newCount2 = await tenantQuery2.count('users');

      expect(newCount1).toBe(initialCount1 + 1);
      expect(newCount2).toBe(initialCount2); // Sin cambios
    });

    test('should update only tenant-specific records', async () => {
      // Crear usuarios en ambos tenants con el mismo nombre inicial
      const [user1] = await tenantQuery1.insert('users', {
        name: 'Update Test',
        email: 'update1@test.com',
        phone: '3005555555',
        password_hash: 'hash',
        role: 'feligres'
      }).returning('*');

      const [user2] = await tenantQuery2.insert('users', {
        name: 'Update Test',
        email: 'update2@test.com',
        phone: '3006666666',
        password_hash: 'hash',
        role: 'feligres'
      }).returning('*');

      // Actualizar usuarios con nombre "Update Test" en tenant1
      await tenantQuery1.update('users', 
        { name: 'Updated by Tenant 1' }, 
        { name: 'Update Test' }
      );

      // Verificar que solo el usuario de tenant1 fue actualizado
      const updatedUser1 = await db('users').where('id', user1.id).first();
      const updatedUser2 = await db('users').where('id', user2.id).first();

      expect(updatedUser1.name).toBe('Updated by Tenant 1');
      expect(updatedUser2.name).toBe('Update Test'); // Sin cambios
    });

    test('should handle pagination correctly per tenant', async () => {
      // Crear varios usuarios en tenant1
      const users = [];
      for (let i = 0; i < 5; i++) {
        users.push({
          name: `Pagination User ${i}`,
          email: `pagination${i}@tenant1.com`,
          phone: `30077777${i}${i}`,
          password_hash: 'hash',
          role: 'feligres'
        });
      }

      await tenantQuery1.insert('users', users);

      // Probar paginación
      const page1 = await tenantQuery1.findWithPagination('users', {
        page: 1,
        limit: 3,
        orderBy: 'name'
      });

      expect(page1.data.length).toBeLessThanOrEqual(3);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.limit).toBe(3);
      expect(page1.pagination.total).toBeGreaterThanOrEqual(5);

      // Verificar que todos los resultados pertenecen al tenant correcto
      page1.data.forEach(user => {
        expect(user.tenant_id).toBe(tenant1.id);
      });
    });

    test('should handle transactions with tenant isolation', async () => {
      await tenantQuery1.transaction(async (trx) => {
        // Crear usuario dentro de la transacción
        await trx.insert('users', {
          name: 'Transaction User',
          email: 'transaction@test.com',
          phone: '3008888888',
          password_hash: 'hash',
          role: 'feligres'
        });

        // Verificar que el usuario existe dentro de la transacción
        const users = await trx.table('users')
          .where('email', 'transaction@test.com');
        
        expect(users.length).toBe(1);
        expect(users[0].tenant_id).toBe(tenant1.id);
      });

      // Verificar que el usuario fue creado correctamente después de la transacción
      const user = await db('users')
        .where('email', 'transaction@test.com')
        .first();

      expect(user).toBeDefined();
      expect(user.tenant_id).toBe(tenant1.id);
    });
  });

  describe('Tenant Model Integration', () => {
    test('should create tenants with unique slugs', async () => {
      const tenant = await Tenant.create({
        name: 'Integration Test Tenant',
        slug: 'integration-test',
        branding: { colors: { primary: '#123456' } }
      });

      expect(tenant).toBeDefined();
      expect(tenant.slug).toBe('integration-test');
      expect(tenant.name).toBe('Integration Test Tenant');

      // Limpiar
      await db('tenants').where('id', tenant.id).del();
    });

    test('should prevent duplicate slugs', async () => {
      const tenant1 = await Tenant.create({
        name: 'Duplicate Test 1',
        slug: 'duplicate-test',
        branding: { colors: { primary: '#111111' } }
      });

      // Intentar crear otro tenant con el mismo slug debería fallar
      await expect(Tenant.create({
        name: 'Duplicate Test 2',
        slug: 'duplicate-test',
        branding: { colors: { primary: '#222222' } }
      })).rejects.toThrow();

      // Limpiar
      await db('tenants').where('id', tenant1.id).del();
    });

    test('should get tenant statistics correctly', async () => {
      // Crear algunos usuarios para el tenant
      await tenantQuery1.insert('users', [
        {
          name: 'Stats User 1',
          email: 'stats1@test.com',
          phone: '3009999991',
          password_hash: 'hash',
          role: 'feligres'
        },
        {
          name: 'Stats User 2',
          email: 'stats2@test.com',
          phone: '3009999992',
          password_hash: 'hash',
          role: 'coordinador'
        }
      ]);

      const stats = await tenantQuery1.getStats();

      expect(stats).toBeDefined();
      expect(stats.users).toBeGreaterThanOrEqual(2);
      expect(stats.campaigns).toBeGreaterThanOrEqual(0);
      expect(stats.donations).toBeGreaterThanOrEqual(0);
      expect(stats.purchases).toBeGreaterThanOrEqual(0);
      expect(typeof stats.totalRaised).toBe('number');
    });
  });
});