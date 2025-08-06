exports.up = function(knex) {
  return knex.schema.createTable('tenants', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('slug').unique().notNullable();
    table.string('logo_url');
    table.json('config').defaultTo('{}');
    table.json('branding').defaultTo('{}');
    table.json('contact_info').defaultTo('{}');
    table.json('settings').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    // Índices
    table.index('slug');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tenants');
};