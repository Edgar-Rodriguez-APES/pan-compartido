exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('email').notNullable();
    table.string('phone').notNullable();
    table.string('password_hash');
    table.enum('role', ['feligres', 'coordinador', 'parroco', 'admin']).defaultTo('feligres');
    table.json('preferences').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.boolean('email_verified').defaultTo(false);
    table.boolean('phone_verified').defaultTo(false);
    table.timestamp('last_login');
    table.timestamps(true, true);
    
    // Índices
    table.unique(['tenant_id', 'email']);
    table.unique(['tenant_id', 'phone']);
    table.index('tenant_id');
    table.index('role');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};