exports.seed = async function(knex) {
  // Limpiar tabla existente
  await knex('products').del();

  // Insertar productos básicos
  await knex('products').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Arroz Blanco',
      slug: 'arroz-blanco',
      category: 'granos',
      description: 'Arroz blanco de primera calidad',
      unit: 'kg',
      standard_package: 25,
      estimated_price: 4500,
      image_url: '/images/products/arroz.jpg'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Aceite de Cocina',
      slug: 'aceite-cocina',
      category: 'aceites',
      description: 'Aceite vegetal para cocinar',
      unit: 'litros',
      standard_package: 1,
      estimated_price: 8500,
      image_url: '/images/products/aceite.jpg'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Lentejas',
      slug: 'lentejas',
      category: 'granos',
      description: 'Lentejas secas de alta calidad',
      unit: 'kg',
      standard_package: 1,
      estimated_price: 6000,
      image_url: '/images/products/lentejas.jpg'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Pasta Espagueti',
      slug: 'pasta-espagueti',
      category: 'pastas',
      description: 'Pasta espagueti de trigo',
      unit: 'paquetes',
      standard_package: 1,
      estimated_price: 3500,
      image_url: '/images/products/pasta.jpg'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Atún en Lata',
      slug: 'atun-lata',
      category: 'enlatados',
      description: 'Atún en agua, lata de 170g',
      unit: 'latas',
      standard_package: 1,
      estimated_price: 4200,
      image_url: '/images/products/atun.jpg'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Azúcar Blanca',
      slug: 'azucar-blanca',
      category: 'endulzantes',
      description: 'Azúcar blanca refinada',
      unit: 'kg',
      standard_package: 1,
      estimated_price: 3800,
      image_url: '/images/products/azucar.jpg'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Frijoles Rojos',
      slug: 'frijoles-rojos',
      category: 'granos',
      description: 'Frijoles rojos secos',
      unit: 'kg',
      standard_package: 1,
      estimated_price: 7500,
      image_url: '/images/products/frijoles.jpg'
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Sal de Mesa',
      slug: 'sal-mesa',
      category: 'condimentos',
      description: 'Sal refinada de mesa',
      unit: 'kg',
      standard_package: 1,
      estimated_price: 1500,
      image_url: '/images/products/sal.jpg'
    }
  ]);
};