exports.up = function(knex) {
  return knex.schema.createTable('purchases', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.json('items').notNullable(); // [{ "product_id": "uuid", "quantity": 5, "unit_price": 4500 }]
    table.decimal('subtotal', 10, 2).notNullable();
    table.decimal('platform_fee', 10, 2).notNullable();
    table.decimal('total_amount', 10, 2).notNullable();
    table.enum('status', ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']).defaultTo('pending');
    table.json('delivery_info').defaultTo('{}');
    table.timestamp('paid_at');
    table.timestamp('shipped_at');
    table.timestamp('delivered_at');
    table.timestamps(true, true);
    
    // Índices
    table.index('tenant_id');
    table.index('user_id');
    table.index('status');
    table.index(['tenant_id', 'status']);
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('purchases');
};