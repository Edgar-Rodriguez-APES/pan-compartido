exports.up = function(knex) {
  return knex.schema.createTable('payments', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('donation_id').references('id').inTable('donations').onDelete('SET NULL');
    table.uuid('purchase_id').references('id').inTable('purchases').onDelete('SET NULL');
    table.decimal('donation_amount', 10, 2).defaultTo(0);
    table.decimal('purchase_amount', 10, 2).defaultTo(0);
    table.decimal('platform_fee', 10, 2).notNullable();
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('payment_method'); // credit_card, debit_card, pse, nequi, etc.
    table.string('gateway'); // stripe, wompi, payu
    table.string('gateway_transaction_id');
    table.json('gateway_response').defaultTo('{}');
    table.enum('status', ['pending', 'processing', 'completed', 'failed', 'refunded']).defaultTo('pending');
    table.text('failure_reason');
    table.timestamp('processed_at');
    table.timestamps(true, true);
    
    // Índices
    table.index('tenant_id');
    table.index('user_id');
    table.index('donation_id');
    table.index('purchase_id');
    table.index('status');
    table.index('gateway_transaction_id');
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('payments');
};