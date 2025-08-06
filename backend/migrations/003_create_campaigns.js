exports.up = function(knex) {
  return knex.schema.createTable('campaigns', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.string('title').notNullable();
    table.text('description');
    table.json('goals').defaultTo('{}'); // { "arroz": { "needed": 25, "unit": "kg" } }
    table.json('current_progress').defaultTo('{}'); // { "arroz": { "received": 10, "unit": "kg" } }
    table.enum('status', ['draft', 'active', 'completed', 'cancelled']).defaultTo('draft');
    table.enum('frequency', ['weekly', 'biweekly', 'monthly']).defaultTo('weekly');
    table.date('start_date');
    table.date('end_date');
    table.decimal('target_amount', 12, 2);
    table.decimal('raised_amount', 12, 2).defaultTo(0);
    table.integer('target_families');
    table.integer('helped_families').defaultTo(0);
    table.timestamps(true, true);
    
    // Índices
    table.index('tenant_id');
    table.index('status');
    table.index(['tenant_id', 'status']);
    table.index('start_date');
    table.index('end_date');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('campaigns');
};