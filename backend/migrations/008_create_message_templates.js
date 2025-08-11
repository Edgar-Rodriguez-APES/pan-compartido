exports.up = function(knex) {
  return knex.schema.createTable('message_templates', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.string('channel').notNullable(); // whatsapp, email, push
    table.string('template_key').notNullable(); // welcome, campaign_new, etc.
    table.string('name').notNullable();
    table.text('content'); // Para WhatsApp y contenido general
    table.string('subject'); // Para emails
    table.string('title'); // Para push notifications
    table.text('body'); // Para push notifications
    table.json('variables').defaultTo('[]'); // Variables disponibles
    table.string('category').notNullable(); // onboarding, campaigns, donations, etc.
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    // Índices
    table.index('tenant_id');
    table.index('channel');
    table.index('category');
    table.index(['tenant_id', 'channel']);
    table.index(['tenant_id', 'category']);
    table.unique(['tenant_id', 'channel', 'template_key']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('message_templates');
};