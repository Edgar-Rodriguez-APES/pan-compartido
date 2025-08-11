exports.up = function(knex) {
  return knex.schema.createTable('product_categories', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('slug').unique().notNullable();
    table.text('description');
    table.string('icon'); // Nombre del icono para UI
    table.string('color').defaultTo('#6b7280'); // Color hex para UI
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.json('metadata').defaultTo('{}'); // Datos adicionales flexibles
    table.timestamps(true, true);
    
    // Índices
    table.index('slug');
    table.index('is_active');
    table.index('sort_order');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('product_categories');
};