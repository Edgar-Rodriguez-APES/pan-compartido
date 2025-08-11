exports.up = function(knex) {
  return knex.schema.alterTable('products', function(table) {
    // Agregar nueva columna para referencia a categoría
    table.uuid('category_id').references('id').inTable('product_categories').onDelete('SET NULL');
    
    // Agregar campos adicionales para mejor gestión
    table.json('nutritional_info').defaultTo('{}'); // Información nutricional
    table.json('storage_info').defaultTo('{}'); // Información de almacenamiento
    table.string('brand'); // Marca del producto
    table.string('barcode'); // Código de barras
    table.decimal('weight', 8, 3); // Peso en kg
    table.decimal('volume', 8, 3); // Volumen en litros
    table.json('tags').defaultTo('[]'); // Etiquetas para búsqueda
    table.integer('sort_order').defaultTo(0); // Orden de visualización
    table.date('expiry_date'); // Fecha de vencimiento (para productos perecederos)
    
    // Índices adicionales
    table.index('category_id');
    table.index('brand');
    table.index('sort_order');
    table.index('expiry_date');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('products', function(table) {
    table.dropColumn('category_id');
    table.dropColumn('nutritional_info');
    table.dropColumn('storage_info');
    table.dropColumn('brand');
    table.dropColumn('barcode');
    table.dropColumn('weight');
    table.dropColumn('volume');
    table.dropColumn('tags');
    table.dropColumn('sort_order');
    table.dropColumn('expiry_date');
  });
};