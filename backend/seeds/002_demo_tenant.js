const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Crear tenant de demostración
  const [tenant] = await knex('tenants').insert({
    id: knex.raw('gen_random_uuid()'),
    name: 'Parroquia San José - Demo',
    slug: 'demo',
    branding: {
      logo: '/logos/demo-logo.png',
      colors: {
        primary: '#2563eb',
        secondary: '#10b981'
      }
    },
    contact_info: {
      phone: '300-123-4567',
      email: 'contacto@demo.pancompartido.org',
      address: 'Calle 123 #45-67, Bogotá, Colombia'
    },
    settings: {
      campaignFrequency: 'weekly',
      minOrderAmount: 50000,
      platformFeePercentage: 5
    }
  }).returning('*');

  // Crear usuario administrador para el tenant demo
  const passwordHash = await bcrypt.hash('admin123', 12);
  
  await knex('users').insert({
    id: knex.raw('gen_random_uuid()'),
    tenant_id: tenant.id,
    name: 'Administrador Demo',
    email: 'admin@demo.pancompartido.org',
    phone: '3001234567',
    password_hash: passwordHash,
    role: 'parroco',
    email_verified: true,
    phone_verified: true
  });

  // Crear algunos usuarios feligreses de ejemplo
  const feligresPassword = await bcrypt.hash('feligres123', 12);
  
  await knex('users').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      tenant_id: tenant.id,
      name: 'María González',
      email: 'maria@example.com',
      phone: '3009876543',
      password_hash: feligresPassword,
      role: 'feligres',
      email_verified: true,
      phone_verified: true
    },
    {
      id: knex.raw('gen_random_uuid()'),
      tenant_id: tenant.id,
      name: 'Carlos Rodríguez',
      email: 'carlos@example.com',
      phone: '3001112233',
      password_hash: feligresPassword,
      role: 'feligres',
      email_verified: true,
      phone_verified: true
    }
  ]);
};