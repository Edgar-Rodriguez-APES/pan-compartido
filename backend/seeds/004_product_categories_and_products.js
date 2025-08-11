exports.seed = async function(knex) {
  // Limpiar tablas existentes
  await knex('products').del();
  await knex('product_categories').del();

  // Crear categorías de productos
  const categories = [
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Granos y Cereales',
      slug: 'granos-cereales',
      description: 'Arroz, frijoles, lentejas, quinoa y otros granos básicos',
      icon: 'grain',
      color: '#f59e0b',
      sort_order: 1,
      metadata: {
        nutritionFocus: 'carbohidratos',
        storageType: 'seco'
      }
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Aceites y Grasas',
      slug: 'aceites-grasas',
      description: 'Aceites de cocina, mantequilla, margarina',
      icon: 'droplet',
      color: '#eab308',
      sort_order: 2,
      metadata: {
        nutritionFocus: 'grasas',
        storageType: 'temperatura_ambiente'
      }
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Proteínas',
      slug: 'proteinas',
      description: 'Carnes, pescados, huevos, productos lácteos',
      icon: 'beef',
      color: '#dc2626',
      sort_order: 3,
      metadata: {
        nutritionFocus: 'proteinas',
        storageType: 'refrigerado'
      }
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Frutas y Verduras',
      slug: 'frutas-verduras',
      description: 'Frutas frescas, verduras, hortalizas',
      icon: 'apple',
      color: '#16a34a',
      sort_order: 4,
      metadata: {
        nutritionFocus: 'vitaminas',
        storageType: 'fresco'
      }
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Lácteos',
      slug: 'lacteos',
      description: 'Leche, queso, yogurt, productos lácteos',
      icon: 'milk',
      color: '#3b82f6',
      sort_order: 5,
      metadata: {
        nutritionFocus: 'calcio',
        storageType: 'refrigerado'
      }
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Condimentos y Especias',
      slug: 'condimentos-especias',
      description: 'Sal, azúcar, especias, condimentos',
      icon: 'pepper',
      color: '#a855f7',
      sort_order: 6,
      metadata: {
        nutritionFocus: 'sabor',
        storageType: 'seco'
      }
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Productos de Limpieza',
      slug: 'productos-limpieza',
      description: 'Jabones, detergentes, productos de higiene',
      icon: 'spray-can',
      color: '#06b6d4',
      sort_order: 7,
      metadata: {
        category: 'no_alimentario',
        storageType: 'seco'
      }
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Productos de Higiene',
      slug: 'productos-higiene',
      description: 'Champú, jabón de baño, pasta dental, papel higiénico',
      icon: 'bath',
      color: '#8b5cf6',
      sort_order: 8,
      metadata: {
        category: 'no_alimentario',
        storageType: 'seco'
      }
    }
  ];

  const insertedCategories = await knex('product_categories').insert(categories).returning('*');

  // Crear productos para cada categoría
  const products = [];

  // Granos y Cereales
  const granosCategory = insertedCategories.find(c => c.slug === 'granos-cereales');
  products.push(
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Arroz Blanco',
      slug: 'arroz-blanco',
      category: 'granos', // Legacy
      category_id: granosCategory.id,
      description: 'Arroz blanco de grano largo, ideal para acompañamientos',
      image_url: '/images/products/arroz-blanco.jpg',
      unit: 'kg',
      standard_package: 25,
      estimated_price: 4500,
      nutritional_info: {
        calories: 130,
        protein: 2.7,
        carbs: 28,
        fat: 0.3,
        fiber: 0.4
      },
      storage_info: {
        temperature: 'ambiente',
        humidity: 'baja',
        duration: '12 meses'
      },
      brand: 'Roa',
      weight: 25,
      tags: ['basico', 'carbohidrato', 'acompañamiento'],
      sort_order: 1
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Frijol Rojo',
      slug: 'frijol-rojo',
      category: 'granos',
      category_id: granosCategory.id,
      description: 'Frijol rojo seco, rico en proteína vegetal',
      image_url: '/images/products/frijol-rojo.jpg',
      unit: 'kg',
      standard_package: 10,
      estimated_price: 8500,
      nutritional_info: {
        calories: 245,
        protein: 15.3,
        carbs: 45,
        fat: 1.1,
        fiber: 15.5
      },
      storage_info: {
        temperature: 'ambiente',
        humidity: 'baja',
        duration: '24 meses'
      },
      weight: 10,
      tags: ['proteina', 'fibra', 'legumbre'],
      sort_order: 2
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Lenteja',
      slug: 'lenteja',
      category: 'granos',
      category_id: granosCategory.id,
      description: 'Lentejas secas, excelente fuente de proteína',
      image_url: '/images/products/lenteja.jpg',
      unit: 'kg',
      standard_package: 5,
      estimated_price: 7200,
      nutritional_info: {
        calories: 230,
        protein: 17.9,
        carbs: 40,
        fat: 0.8,
        fiber: 15.6
      },
      weight: 5,
      tags: ['proteina', 'fibra', 'legumbre', 'hierro'],
      sort_order: 3
    }
  );

  // Aceites y Grasas
  const aceitesCategory = insertedCategories.find(c => c.slug === 'aceites-grasas');
  products.push(
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Aceite de Girasol',
      slug: 'aceite-girasol',
      category: 'aceites',
      category_id: aceitesCategory.id,
      description: 'Aceite de girasol refinado para cocinar',
      image_url: '/images/products/aceite-girasol.jpg',
      unit: 'litros',
      standard_package: 20,
      estimated_price: 8000,
      nutritional_info: {
        calories: 884,
        fat: 100,
        saturated_fat: 10.3,
        vitamin_e: 41.08
      },
      storage_info: {
        temperature: 'ambiente',
        light: 'protegido',
        duration: '18 meses'
      },
      brand: 'Gourmet',
      volume: 20,
      tags: ['cocina', 'vitamina-e'],
      sort_order: 1
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Aceite de Soya',
      slug: 'aceite-soya',
      category: 'aceites',
      category_id: aceitesCategory.id,
      description: 'Aceite de soya para freír y cocinar',
      image_url: '/images/products/aceite-soya.jpg',
      unit: 'litros',
      standard_package: 20,
      estimated_price: 7500,
      volume: 20,
      tags: ['cocina', 'freir'],
      sort_order: 2
    }
  );

  // Proteínas
  const proteinasCategory = insertedCategories.find(c => c.slug === 'proteinas');
  products.push(
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Atún en Lata',
      slug: 'atun-lata',
      category: 'proteinas',
      category_id: proteinasCategory.id,
      description: 'Atún en agua, lata de 170g',
      image_url: '/images/products/atun-lata.jpg',
      unit: 'latas',
      standard_package: 48,
      estimated_price: 3500,
      nutritional_info: {
        calories: 116,
        protein: 25.5,
        fat: 0.8,
        omega3: 0.3
      },
      storage_info: {
        temperature: 'ambiente',
        duration: '36 meses'
      },
      brand: 'Van Camps',
      weight: 0.17,
      tags: ['proteina', 'omega3', 'conserva'],
      sort_order: 1
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Sardinas en Lata',
      slug: 'sardinas-lata',
      category: 'proteinas',
      category_id: proteinasCategory.id,
      description: 'Sardinas en salsa de tomate, lata de 425g',
      image_url: '/images/products/sardinas-lata.jpg',
      unit: 'latas',
      standard_package: 24,
      estimated_price: 4200,
      nutritional_info: {
        calories: 208,
        protein: 24.6,
        fat: 11.5,
        calcium: 382
      },
      brand: 'Colsubsidio',
      weight: 0.425,
      tags: ['proteina', 'calcio', 'conserva'],
      sort_order: 2
    }
  );

  // Frutas y Verduras
  const frutasCategory = insertedCategories.find(c => c.slug === 'frutas-verduras');
  products.push(
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Plátano Verde',
      slug: 'platano-verde',
      category: 'frutas',
      category_id: frutasCategory.id,
      description: 'Plátano verde para cocinar',
      image_url: '/images/products/platano-verde.jpg',
      unit: 'kg',
      standard_package: 20,
      estimated_price: 2800,
      nutritional_info: {
        calories: 122,
        protein: 1.3,
        carbs: 31.9,
        fiber: 2.3,
        potassium: 499
      },
      storage_info: {
        temperature: 'ambiente',
        humidity: 'media',
        duration: '7 dias'
      },
      weight: 20,
      tags: ['carbohidrato', 'potasio', 'fresco'],
      sort_order: 1,
      expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Cebolla Blanca',
      slug: 'cebolla-blanca',
      category: 'verduras',
      category_id: frutasCategory.id,
      description: 'Cebolla blanca fresca',
      image_url: '/images/products/cebolla-blanca.jpg',
      unit: 'kg',
      standard_package: 25,
      estimated_price: 3200,
      nutritional_info: {
        calories: 40,
        protein: 1.1,
        carbs: 9.3,
        fiber: 1.7,
        vitamin_c: 7.4
      },
      weight: 25,
      tags: ['condimento', 'vitamina-c', 'fresco'],
      sort_order: 2,
      expiry_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 días
    }
  );

  // Lácteos
  const lacteosCategory = insertedCategories.find(c => c.slug === 'lacteos');
  products.push(
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Leche en Polvo',
      slug: 'leche-polvo',
      category: 'lacteos',
      category_id: lacteosCategory.id,
      description: 'Leche en polvo entera, bolsa de 900g',
      image_url: '/images/products/leche-polvo.jpg',
      unit: 'bolsas',
      standard_package: 12,
      estimated_price: 15000,
      nutritional_info: {
        calories: 496,
        protein: 26.3,
        carbs: 38.4,
        fat: 26.7,
        calcium: 1257
      },
      storage_info: {
        temperature: 'ambiente',
        humidity: 'baja',
        duration: '24 meses'
      },
      brand: 'Klim',
      weight: 0.9,
      tags: ['calcio', 'proteina', 'polvo'],
      sort_order: 1
    }
  );

  // Condimentos y Especias
  const condimentosCategory = insertedCategories.find(c => c.slug === 'condimentos-especias');
  products.push(
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Azúcar Blanca',
      slug: 'azucar-blanca',
      category: 'condimentos',
      category_id: condimentosCategory.id,
      description: 'Azúcar blanca refinada',
      image_url: '/images/products/azucar-blanca.jpg',
      unit: 'kg',
      standard_package: 50,
      estimated_price: 3200,
      nutritional_info: {
        calories: 387,
        carbs: 99.98
      },
      storage_info: {
        temperature: 'ambiente',
        humidity: 'baja',
        duration: 'indefinido'
      },
      brand: 'Incauca',
      weight: 50,
      tags: ['endulzante', 'basico'],
      sort_order: 1
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Sal de Mesa',
      slug: 'sal-mesa',
      category: 'condimentos',
      category_id: condimentosCategory.id,
      description: 'Sal de mesa refinada con yodo',
      image_url: '/images/products/sal-mesa.jpg',
      unit: 'kg',
      standard_package: 25,
      estimated_price: 1800,
      nutritional_info: {
        sodium: 38758,
        iodine: 0.02
      },
      storage_info: {
        temperature: 'ambiente',
        humidity: 'baja',
        duration: 'indefinido'
      },
      brand: 'Refisal',
      weight: 25,
      tags: ['condimento', 'yodo', 'basico'],
      sort_order: 2
    }
  );

  // Productos de Limpieza
  const limpiezaCategory = insertedCategories.find(c => c.slug === 'productos-limpieza');
  products.push(
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Detergente en Polvo',
      slug: 'detergente-polvo',
      category: 'limpieza',
      category_id: limpiezaCategory.id,
      description: 'Detergente en polvo para ropa, bolsa de 5kg',
      image_url: '/images/products/detergente-polvo.jpg',
      unit: 'bolsas',
      standard_package: 4,
      estimated_price: 18000,
      storage_info: {
        temperature: 'ambiente',
        humidity: 'baja',
        duration: '36 meses'
      },
      brand: 'Fab',
      weight: 5,
      tags: ['limpieza', 'ropa'],
      sort_order: 1
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Jabón de Lavar',
      slug: 'jabon-lavar',
      category: 'limpieza',
      category_id: limpiezaCategory.id,
      description: 'Jabón en barra para lavar ropa',
      image_url: '/images/products/jabon-lavar.jpg',
      unit: 'barras',
      standard_package: 20,
      estimated_price: 2500,
      storage_info: {
        temperature: 'ambiente',
        duration: '24 meses'
      },
      brand: 'Rey',
      weight: 0.25,
      tags: ['limpieza', 'ropa', 'barra'],
      sort_order: 2
    }
  );

  // Productos de Higiene
  const higieneCategory = insertedCategories.find(c => c.slug === 'productos-higiene');
  products.push(
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Papel Higiénico',
      slug: 'papel-higienico',
      category: 'higiene',
      category_id: higieneCategory.id,
      description: 'Papel higiénico doble hoja, paquete de 12 rollos',
      image_url: '/images/products/papel-higienico.jpg',
      unit: 'paquetes',
      standard_package: 8,
      estimated_price: 12000,
      storage_info: {
        temperature: 'ambiente',
        humidity: 'baja',
        duration: 'indefinido'
      },
      brand: 'Scott',
      tags: ['higiene', 'baño'],
      sort_order: 1
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'Jabón de Baño',
      slug: 'jabon-bano',
      category: 'higiene',
      category_id: higieneCategory.id,
      description: 'Jabón de baño en barra, 125g',
      image_url: '/images/products/jabon-bano.jpg',
      unit: 'barras',
      standard_package: 48,
      estimated_price: 2800,
      storage_info: {
        temperature: 'ambiente',
        duration: '36 meses'
      },
      brand: 'Palmolive',
      weight: 0.125,
      tags: ['higiene', 'baño', 'barra'],
      sort_order: 2
    }
  );

  // Insertar todos los productos
  await knex('products').insert(products);

  console.log(`✅ Creadas ${categories.length} categorías de productos`);
  console.log(`✅ Creados ${products.length} productos de ejemplo`);
  console.log('🎉 Catálogo de productos inicializado exitosamente');
};