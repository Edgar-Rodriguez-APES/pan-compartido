const db = require('../config/database');
const logger = require('./logger');

/**
 * Utilidad para consultas con aislamiento de tenant
 * Asegura que todas las consultas incluyan el tenant_id automáticamente
 */
class TenantQuery {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }

  /**
   * Crear query builder con tenant_id automático
   * @param {string} tableName - Nombre de la tabla
   * @returns {Object} Query builder de Knex con tenant_id aplicado
   */
  table(tableName) {
    // Tablas que no requieren tenant_id (globales)
    const globalTables = ['products', 'knex_migrations', 'knex_migrations_lock'];
    
    if (globalTables.includes(tableName)) {
      return db(tableName);
    }

    // Para todas las demás tablas, agregar tenant_id automáticamente
    return db(tableName).where('tenant_id', this.tenantId);
  }

  /**
   * Insertar con tenant_id automático
   * @param {string} tableName - Nombre de la tabla
   * @param {Object|Array} data - Datos a insertar
   * @returns {Promise} Query de inserción
   */
  async insert(tableName, data) {
    const globalTables = ['products', 'knex_migrations', 'knex_migrations_lock'];
    
    if (globalTables.includes(tableName)) {
      return db(tableName).insert(data);
    }

    // Agregar tenant_id a los datos
    if (Array.isArray(data)) {
      const dataWithTenant = data.map(item => ({
        ...item,
        tenant_id: this.tenantId
      }));
      return db(tableName).insert(dataWithTenant);
    } else {
      const dataWithTenant = {
        ...data,
        tenant_id: this.tenantId
      };
      return db(tableName).insert(dataWithTenant);
    }
  }

  /**
   * Actualizar con validación de tenant_id
   * @param {string} tableName - Nombre de la tabla
   * @param {Object} data - Datos a actualizar
   * @param {Object} where - Condiciones where
   * @returns {Promise} Query de actualización
   */
  async update(tableName, data, where = {}) {
    const globalTables = ['products', 'knex_migrations', 'knex_migrations_lock'];
    
    if (globalTables.includes(tableName)) {
      return db(tableName).where(where).update(data);
    }

    // Asegurar que la actualización solo afecte registros del tenant
    return db(tableName)
      .where('tenant_id', this.tenantId)
      .where(where)
      .update(data);
  }

  /**
   * Eliminar con validación de tenant_id
   * @param {string} tableName - Nombre de la tabla
   * @param {Object} where - Condiciones where
   * @returns {Promise} Query de eliminación
   */
  async delete(tableName, where = {}) {
    const globalTables = ['products', 'knex_migrations', 'knex_migrations_lock'];
    
    if (globalTables.includes(tableName)) {
      return db(tableName).where(where).del();
    }

    // Asegurar que la eliminación solo afecte registros del tenant
    return db(tableName)
      .where('tenant_id', this.tenantId)
      .where(where)
      .del();
  }

  /**
   * Contar registros con tenant_id
   * @param {string} tableName - Nombre de la tabla
   * @param {Object} where - Condiciones where adicionales
   * @returns {Promise<number>} Número de registros
   */
  async count(tableName, where = {}) {
    const globalTables = ['products', 'knex_migrations', 'knex_migrations_lock'];
    
    let query = globalTables.includes(tableName) 
      ? db(tableName) 
      : db(tableName).where('tenant_id', this.tenantId);

    if (Object.keys(where).length > 0) {
      query = query.where(where);
    }

    const result = await query.count('* as count').first();
    return parseInt(result.count) || 0;
  }

  /**
   * Buscar un registro por ID con validación de tenant
   * @param {string} tableName - Nombre de la tabla
   * @param {string} id - ID del registro
   * @returns {Promise<Object|null>} Registro encontrado o null
   */
  async findById(tableName, id) {
    const globalTables = ['products', 'knex_migrations', 'knex_migrations_lock'];
    
    if (globalTables.includes(tableName)) {
      return db(tableName).where('id', id).first();
    }

    return db(tableName)
      .where('tenant_id', this.tenantId)
      .where('id', id)
      .first();
  }

  /**
   * Buscar registros con paginación y tenant_id
   * @param {string} tableName - Nombre de la tabla
   * @param {Object} options - Opciones de búsqueda
   * @returns {Promise<Object>} Resultado con datos y paginación
   */
  async findWithPagination(tableName, options = {}) {
    const {
      page = 1,
      limit = 20,
      where = {},
      orderBy = 'created_at',
      orderDirection = 'desc'
    } = options;

    const offset = (page - 1) * limit;
    const globalTables = ['products', 'knex_migrations', 'knex_migrations_lock'];

    // Query base
    let baseQuery = globalTables.includes(tableName) 
      ? db(tableName) 
      : db(tableName).where('tenant_id', this.tenantId);

    // Aplicar filtros adicionales
    if (Object.keys(where).length > 0) {
      baseQuery = baseQuery.where(where);
    }

    // Obtener total para paginación
    const totalQuery = baseQuery.clone();
    const [{ count: total }] = await totalQuery.count('* as count');

    // Obtener registros paginados
    const records = await baseQuery
      .orderBy(orderBy, orderDirection)
      .limit(limit)
      .offset(offset);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Ejecutar transacción con contexto de tenant
   * @param {Function} callback - Función que recibe el objeto de transacción
   * @returns {Promise} Resultado de la transacción
   */
  async transaction(callback) {
    return db.transaction(async (trx) => {
      // Crear una nueva instancia de TenantQuery para la transacción
      const tenantTrx = new TenantQuery(this.tenantId);
      
      // Reemplazar el objeto db con la transacción
      const originalDb = db;
      tenantTrx.db = trx;
      
      // Sobrescribir métodos para usar la transacción
      tenantTrx.table = (tableName) => {
        const globalTables = ['products', 'knex_migrations', 'knex_migrations_lock'];
        
        if (globalTables.includes(tableName)) {
          return trx(tableName);
        }
        
        return trx(tableName).where('tenant_id', this.tenantId);
      };

      try {
        return await callback(tenantTrx);
      } catch (error) {
        logger.error('Error en transacción de tenant:', {
          tenantId: this.tenantId,
          error: error.message
        });
        throw error;
      }
    });
  }

  /**
   * Validar que un registro pertenece al tenant actual
   * @param {string} tableName - Nombre de la tabla
   * @param {string} recordId - ID del registro
   * @returns {Promise<boolean>} True si el registro pertenece al tenant
   */
  async validateOwnership(tableName, recordId) {
    const globalTables = ['products', 'knex_migrations', 'knex_migrations_lock'];
    
    if (globalTables.includes(tableName)) {
      // Para tablas globales, solo verificar que existe
      const record = await db(tableName).where('id', recordId).first();
      return !!record;
    }

    const record = await db(tableName)
      .where('tenant_id', this.tenantId)
      .where('id', recordId)
      .first();

    return !!record;
  }

  /**
   * Obtener estadísticas básicas del tenant
   * @returns {Promise<Object>} Estadísticas del tenant
   */
  async getStats() {
    try {
      const [
        usersCount,
        campaignsCount,
        donationsCount,
        purchasesCount,
        totalRaised
      ] = await Promise.all([
        this.count('users', { is_active: true }),
        this.count('campaigns'),
        this.count('donations'),
        this.count('purchases'),
        db('payments')
          .where('tenant_id', this.tenantId)
          .where('status', 'completed')
          .sum('total_amount as total')
          .first()
      ]);

      return {
        users: usersCount,
        campaigns: campaignsCount,
        donations: donationsCount,
        purchases: purchasesCount,
        totalRaised: parseFloat(totalRaised?.total || 0)
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas del tenant:', {
        tenantId: this.tenantId,
        error: error.message
      });
      throw error;
    }
  }
}

/**
 * Factory function para crear instancia de TenantQuery
 * @param {string} tenantId - ID del tenant
 * @returns {TenantQuery} Instancia de TenantQuery
 */
function createTenantQuery(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID es requerido para crear TenantQuery');
  }
  
  return new TenantQuery(tenantId);
}

module.exports = {
  TenantQuery,
  createTenantQuery
};