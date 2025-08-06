exports.up = function(knex) {
  return knex.schema.createTable('donations', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('campaign_id').references('id').inTable('campaigns').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.json('items').notNullable(); // [{ "product_id": "uuid", "quantity": 10, "unit": "kg" }]
    table.decimal('estimated_value', 10, 2);
    table.enum('status', ['pending', 'confirmed', 'received', 'distributed']).defaultTo('pending');
    table.enum('source', ['app', 'whatsapp', 'social', 'manual']).defaultTo('app');
    table.text('notes');
    table.timestamp('confirmed_at');
    table.timestamp('received_at');
    table.timestamps(true, true);
    
    // Índices
    table.index('tenant_id');
    table.index('campaign_id');
    table.index('user_id');
    table.index('status');
    table.index(['tenant_id', 'status']);
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('donations');
};