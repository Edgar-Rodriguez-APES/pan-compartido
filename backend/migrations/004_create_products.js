exports.up = function(knex) {
  return knex.schema.createTable('products', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('slug').unique().notNullable();
    table.string('category').notNullable();
    table.text('description');
    table.string('image_url');
    table.string('unit').notNullable(); // kg, litros, paquetes, latas, unidades
    table.integer('standard_package').defaultTo(1);
    table.decimal('estimated_price', 10, 2);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    // Índices
    table.index('slug');
    table.index('category');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('products');
};