const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Crear múltiples tenants para demostrar la funcionalidad multi-tenant
  const tenants = [
    {
      name: 'Parroquia Santa María',
      slug: 'santa-maria',
      branding: {
        logo: '/logos/santa-maria-logo.png',
        colors: {
          primary: '#1e40af',
          secondary: '#059669'
        }
      },
      contact_info: {
        phone: '300-555-0001',
        email: 'contacto@santamaria.pancompartido.org',
        address: 'Carrera 15 #32-45, Medellín, Colombia'
      },
      settings: {
        campaignFrequency: 'weekly',
        minOrderAmount: 75000,
        platformFeePercentage: 4
      }
    },
    {
      name: 'Parroquia San Pedro',
      slug: 'san-pedro',
      branding: {
        logo: '/logos/san-pedro-logo.png',
        colors: {
          primary: '#dc2626',
          secondary: '#ea580c'
        }
      },
      contact_info: {
        phone: '300-555-0002',
        email: 'contacto@sanpedro.pancompartido.org',
        address: 'Avenida 68 #45-23, Cali, Colombia'
      },
      settings: {
        campaignFrequency: 'biweekly',
        minOrderAmount: 60000,
        platformFeePercentage: 5
      }
    },
    {
      name: 'Parroquia Sagrado Corazón',
      slug: 'sagrado-corazon',
      branding: {
        logo: '/logos/sagrado-corazon-logo.png',
        colors: {
          primary: '#7c3aed',
          secondary: '#c026d3'
        }
      },
      contact_info: {
        phone: '300-555-0003',
        email: 'contacto@sagradocorazon.pancompartido.org',
        address: 'Calle 85 #12-34, Barranquilla, Colombia'
      },
      settings: {
        campaignFrequency: 'weekly',
        minOrderAmount: 80000,
        platformFeePercentage: 6
      }
    }
  ];

  const passwordHash = await bcrypt.hash('parroco123', 12);
  const feligresPassword = await bcrypt.hash('feligres123', 12);

  for (const tenantData of tenants) {
    // Crear tenant
    const [tenant] = await knex('tenants').insert({
      id: knex.raw('gen_random_uuid()'),
      name: tenantData.name,
      slug: tenantData.slug,
      branding: tenantData.branding,
      contact_info: tenantData.contact_info,
      settings: tenantData.settings
    }).returning('*');

    // Crear párroco para cada tenant
    await knex('users').insert({
      id: knex.raw('gen_random_uuid()'),
      tenant_id: tenant.id,
      name: `Padre ${tenantData.slug.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      email: `parroco@${tenantData.slug}.pancompartido.org`,
      phone: `300555${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      password_hash: passwordHash,
      role: 'parroco',
      email_verified: true,
      phone_verified: true
    });

    // Crear coordinador para cada tenant
    await knex('users').insert({
      id: knex.raw('gen_random_uuid()'),
      tenant_id: tenant.id,
      name: `Coordinador ${tenantData.name}`,
      email: `coordinador@${tenantData.slug}.pancompartido.org`,
      phone: `300666${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      password_hash: passwordHash,
      role: 'coordinador',
      email_verified: true,
      phone_verified: true
    });

    // Crear algunos feligreses para cada tenant
    const feligreses = [
      { name: 'Ana Martínez', email: `ana@${tenantData.slug}.example.com` },
      { name: 'Luis Hernández', email: `luis@${tenantData.slug}.example.com` },
      { name: 'Carmen López', email: `carmen@${tenantData.slug}.example.com` },
      { name: 'Roberto Silva', email: `roberto@${tenantData.slug}.example.com` }
    ];

    for (const feligres of feligreses) {
      await knex('users').insert({
        id: knex.raw('gen_random_uuid()'),
        tenant_id: tenant.id,
        name: feligres.name,
        email: feligres.email,
        phone: `300777${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        password_hash: feligresPassword,
        role: 'feligres',
        email_verified: true,
        phone_verified: true,
        preferences: {
          notifications: {
            whatsapp: true,
            email: true,
            push: true
          },
          communication_language: 'es'
        }
      });
    }

    // Crear una campaña de ejemplo para cada tenant
    const [campaign] = await knex('campaigns').insert({
      id: knex.raw('gen_random_uuid()'),
      tenant_id: tenant.id,
      title: `Mercados Solidarios - ${tenantData.name}`,
      description: `Campaña semanal para proveer mercados a familias necesitadas de ${tenantData.name}`,
      goals: {
        arroz: { needed: 50, unit: 'kg', estimated_price: 4500 },
        aceite: { needed: 30, unit: 'litros', estimated_price: 8000 },
        atun: { needed: 100, unit: 'latas', estimated_price: 3500 },
        azucar: { needed: 25, unit: 'kg', estimated_price: 3200 },
        pasta: { needed: 40, unit: 'paquetes', estimated_price: 2800 }
      },
      current_progress: {
        arroz: { received: Math.floor(Math.random() * 25), unit: 'kg' },
        aceite: { received: Math.floor(Math.random() * 15), unit: 'litros' },
        atun: { received: Math.floor(Math.random() * 50), unit: 'latas' },
        azucar: { received: Math.floor(Math.random() * 12), unit: 'kg' },
        pasta: { received: Math.floor(Math.random() * 20), unit: 'paquetes' }
      },
      status: 'active',
      frequency: tenantData.settings.campaignFrequency,
      start_date: new Date(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      target_amount: 500000,
      raised_amount: Math.floor(Math.random() * 250000),
      target_families: 50,
      helped_families: Math.floor(Math.random() * 25)
    }).returning('*');

    console.log(`✅ Tenant creado: ${tenantData.name} (${tenantData.slug})`);
  }

  console.log('🎉 Múltiples tenants creados exitosamente');
};