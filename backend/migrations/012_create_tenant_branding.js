/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('tenant_branding', function(table) {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().notNullable();
    table.json('config').notNullable(); // Store complete branding configuration as JSON
    table.integer('created_by').unsigned().nullable();
    table.integer('updated_by').unsigned().nullable();
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
    
    // Indexes
    table.index('tenant_id');
    table.unique('tenant_id'); // One branding config per tenant
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tenant_branding');
};