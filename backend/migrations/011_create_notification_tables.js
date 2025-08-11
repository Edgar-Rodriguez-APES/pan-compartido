/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    // Create notification_subscribers table
    knex.schema.createTable('notification_subscribers', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.integer('user_id').unsigned().nullable();
      table.string('phone_number', 20).notNullable();
      table.boolean('campaign_notifications').defaultTo(true);
      table.boolean('summary_notifications').defaultTo(true);
      table.boolean('urgent_notifications').defaultTo(true);
      table.boolean('active').defaultTo(true);
      table.timestamps(true, true);
      
      // Foreign keys
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
      
      // Indexes
      table.index(['tenant_id', 'active']);
      table.index(['tenant_id', 'phone_number']);
      table.unique(['tenant_id', 'phone_number']);
    }),

    // Create notification_logs table
    knex.schema.createTable('notification_logs', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.string('type', 50).notNullable(); // campaign_created, campaign_urgent, etc.
      table.integer('recipients').defaultTo(0);
      table.integer('successful').defaultTo(0);
      table.integer('failed').defaultTo(0);
      table.json('metadata').nullable(); // Store campaign_id, priority, etc.
      table.timestamps(true, true);
      
      // Foreign keys
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      
      // Indexes
      table.index(['tenant_id', 'type']);
      table.index(['tenant_id', 'created_at']);
    }),

    // Create notification_templates table (for future customization)
    knex.schema.createTable('notification_templates', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.string('type', 50).notNullable(); // matches notification types
      table.string('name', 100).notNullable();
      table.text('content').notNullable();
      table.json('variables').nullable(); // Available template variables
      table.boolean('active').defaultTo(true);
      table.timestamps(true, true);
      
      // Foreign keys
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      
      // Indexes
      table.index(['tenant_id', 'type', 'active']);
      table.unique(['tenant_id', 'type']);
    })
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('notification_templates'),
    knex.schema.dropTableIfExists('notification_logs'),
    knex.schema.dropTableIfExists('notification_subscribers')
  ]);
};