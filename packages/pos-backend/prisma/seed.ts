import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // IDs de ejemplo para la integración con facturacion-core
  const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
  const ESTABLISHMENT_CODE = '001';
  const EMISSION_POINT_CODE = '001';

  // 1. Crear Locales
  console.log('Creando locales...');
  const local1 = await prisma.local.upsert({
    where: { codigo: 'LOC001' },
    update: {},
    create: {
      codigo: 'LOC001',
      nombre: 'Heladería Centro',
      direccion: 'Av. 10 de Agosto y Colón',
      telefono: '022-345-678',
      activo: true,
      companyId: COMPANY_ID,
      establishmentCode: ESTABLISHMENT_CODE,
      emissionPointCode: EMISSION_POINT_CODE,
    },
  });

  const local2 = await prisma.local.upsert({
    where: { codigo: 'LOC002' },
    update: {},
    create: {
      codigo: 'LOC002',
      nombre: 'Heladería Norte',
      direccion: 'Av. Eloy Alfaro N34-451',
      telefono: '022-456-789',
      activo: true,
      companyId: COMPANY_ID,
      establishmentCode: ESTABLISHMENT_CODE,
      emissionPointCode: '002',
    },
  });

  console.log(`✓ Locales creados: ${local1.nombre}, ${local2.nombre}`);

  // 2. Crear Colaboradores
  console.log('Creando colaboradores...');
  const colaborador1 = await prisma.colaborador.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      nombre: 'Juan Pérez',
      apellido: null,
      color: '#3B82F6',
      pin: '1234',
      localId: local1.id,
      activo: true,
    },
  });

  const colaborador2 = await prisma.colaborador.upsert({
    where: { id: '00000000-0000-0000-0000-000000000012' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000012',
      nombre: 'María González',
      apellido: null,
      color: '#EC4899',
      pin: '5678',
      localId: local2.id,
      activo: true,
    },
  });

  console.log(`✓ Colaboradores creados: ${colaborador1.nombre}, ${colaborador2.nombre}`);

  // 3. Crear Categorías
  console.log('Creando categorías...');
  const categoriaHelados = await prisma.categoria.upsert({
    where: { codigo: 'CAT-HEL' },
    update: {},
    create: {
      codigo: 'CAT-HEL',
      nombre: 'Helados',
      color: '#8B5CF6',
      icono: '🍦',
      orden: 1,
      permiteSeleccionarSabores: true,
      cantidadSaboresObligatorios: null, // Varía según el producto
      cantidadSaboresMax: 3,
      permiteSeleccionarToppings: true,
      cantidadToppingsMax: 3,
      permiteSeleccionarAderezos: true,
      cantidadAderezosMax: 2,
      permiteSustituciones: false,
      activa: true,
    },
  });

  const categoriaSalpicones = await prisma.categoria.upsert({
    where: { codigo: 'CAT-SAL' },
    update: {},
    create: {
      codigo: 'CAT-SAL',
      nombre: 'Salpicones',
      color: '#10B981',
      icono: '🍹',
      orden: 2,
      permiteSeleccionarSabores: true,
      cantidadSaboresObligatorios: 1,
      cantidadSaboresMax: 2,
      permiteSeleccionarToppings: true,
      cantidadToppingsMax: 2,
      permiteSeleccionarAderezos: true,
      cantidadAderezosMax: 1,
      permiteSustituciones: true,
      activa: true,
    },
  });

  const categoriaWaffles = await prisma.categoria.upsert({
    where: { codigo: 'CAT-WAF' },
    update: {},
    create: {
      codigo: 'CAT-WAF',
      nombre: 'Waffles',
      color: '#F59E0B',
      icono: '🧇',
      orden: 3,
      permiteSeleccionarSabores: true,
      cantidadSaboresObligatorios: 2,
      cantidadSaboresMax: 2,
      permiteSeleccionarToppings: true,
      cantidadToppingsMax: 3,
      permiteSeleccionarAderezos: true,
      cantidadAderezosMax: 2,
      permiteSustituciones: false,
      activa: true,
    },
  });

  const categoriaConos = await prisma.categoria.upsert({
    where: { codigo: 'CAT-CON' },
    update: {},
    create: {
      codigo: 'CAT-CON',
      nombre: 'Conos',
      color: '#EF4444',
      icono: '🍨',
      orden: 4,
      permiteSeleccionarSabores: true,
      cantidadSaboresObligatorios: null,
      cantidadSaboresMax: 2,
      permiteSeleccionarToppings: false,
      cantidadToppingsMax: null,
      permiteSeleccionarAderezos: false,
      cantidadAderezosMax: null,
      permiteSustituciones: false,
      activa: true,
    },
  });

  console.log(`✓ Categorías creadas: 4`);

  // 4. Crear Modificadores - Sabores
  console.log('Creando modificadores de sabores...');
  const sabores = [
    { nombre: 'Chocolate', precio: 0 },
    { nombre: 'Vainilla', precio: 0 },
    { nombre: 'Fresa', precio: 0 },
    { nombre: 'Mora', precio: 0 },
    { nombre: 'Coco', precio: 0 },
    { nombre: 'Mango', precio: 0 },
    { nombre: 'Limón', precio: 0 },
    { nombre: 'Chicle', precio: 0 },
    { nombre: 'Dulce de Leche', precio: 0 },
    { nombre: 'Menta con Chips', precio: 0 },
  ];

  for (const sabor of sabores) {
    await prisma.modificador.create({
      data: {
        nombre: sabor.nombre,
        tipo: 'SABOR',
        precioAdicional: sabor.precio > 0 ? new Prisma.Decimal(sabor.precio) : null,
        disponible: true,
      },
    });
  }

  // 5. Crear Modificadores - Toppings
  console.log('Creando toppings...');
  const toppings = [
    { nombre: 'Maní', precio: 0.50 },
    { nombre: 'Chips de Chocolate', precio: 0.50 },
    { nombre: 'Oreo', precio: 0.75 },
    { nombre: 'M&Ms', precio: 0.75 },
    { nombre: 'Granola', precio: 0.50 },
    { nombre: 'Coco Rallado', precio: 0.50 },
    { nombre: 'Chispas de Colores', precio: 0.25 },
  ];

  for (const topping of toppings) {
    await prisma.modificador.create({
      data: {
        nombre: topping.nombre,
        tipo: 'TOPPING',
        precioAdicional: new Prisma.Decimal(topping.precio),
        disponible: true,
      },
    });
  }

  // 6. Crear Modificadores - Aderezos
  console.log('Creando aderezos...');
  const aderezos = [
    { nombre: 'Chocolate', precio: 0.50 },
    { nombre: 'Caramelo', precio: 0.50 },
    { nombre: 'Fresa', precio: 0.50 },
    { nombre: 'Leche Condensada', precio: 0.50 },
    { nombre: 'Manjar', precio: 0.50 },
  ];

  for (const aderezo of aderezos) {
    await prisma.modificador.create({
      data: {
        nombre: aderezo.nombre,
        tipo: 'ADEREZO',
        precioAdicional: new Prisma.Decimal(aderezo.precio),
        disponible: true,
      },
    });
  }

  // 7. Crear Modificadores - Sustituciones
  console.log('Creando sustituciones...');
  const sustituciones = [
    { nombre: 'Sin Azúcar', precio: 0 },
    { nombre: 'Leche de Almendras', precio: 0.50 },
    { nombre: 'Leche de Coco', precio: 0.50 },
    { nombre: 'Sin Lactosa', precio: 0 },
  ];

  for (const sustitucion of sustituciones) {
    await prisma.modificador.create({
      data: {
        nombre: sustitucion.nombre,
        tipo: 'SUSTITUCION',
        precioAdicional: sustitucion.precio > 0 ? new Prisma.Decimal(sustitucion.precio) : null,
        disponible: true,
      },
    });
  }

  console.log('✓ Modificadores creados');

  // 8. Crear Productos - Helados
  console.log('Creando productos de helados...');
  const heladoSimple = await prisma.producto.upsert({
    where: { sku: 'HEL-SIM' },
    update: {},
    create: {
      sku: 'HEL-SIM',
      nombre: 'Helado Simple',
      descripcion: 'Helado de un sabor',
      categoriaId: categoriaHelados.id,
      precioBase: new Prisma.Decimal(2.50),
      codigoIVA: '2',
      activo: true,
    },
  });

  const heladoDoble = await prisma.producto.upsert({
    where: { sku: 'HEL-DOB' },
    update: {},
    create: {
      sku: 'HEL-DOB',
      nombre: 'Helado Doble',
      descripcion: 'Helado de dos sabores',
      categoriaId: categoriaHelados.id,
      precioBase: new Prisma.Decimal(3.50),
      codigoIVA: '2',
      activo: true,
    },
  });

  const heladoTriple = await prisma.producto.upsert({
    where: { sku: 'HEL-TRI' },
    update: {},
    create: {
      sku: 'HEL-TRI',
      nombre: 'Helado Triple',
      descripcion: 'Helado de tres sabores',
      categoriaId: categoriaHelados.id,
      precioBase: new Prisma.Decimal(4.50),
      codigoIVA: '2',
      activo: true,
    },
  });

  // 9. Crear Productos - Salpicones
  console.log('Creando productos de salpicones...');
  const salpiconPequeno = await prisma.producto.upsert({
    where: { sku: 'SAL-PEQ' },
    update: {},
    create: {
      sku: 'SAL-PEQ',
      nombre: 'Salpicón Pequeño',
      descripcion: 'Salpicón de frutas con helado - tamaño pequeño',
      categoriaId: categoriaSalpicones.id,
      precioBase: new Prisma.Decimal(4.00),
      codigoIVA: '2',
      activo: true,
    },
  });

  const salpiconGrande = await prisma.producto.upsert({
    where: { sku: 'SAL-GRA' },
    update: {},
    create: {
      sku: 'SAL-GRA',
      nombre: 'Salpicón Grande',
      descripcion: 'Salpicón de frutas con helado - tamaño grande',
      categoriaId: categoriaSalpicones.id,
      precioBase: new Prisma.Decimal(6.00),
      codigoIVA: '2',
      activo: true,
    },
  });

  // 10. Crear Productos - Waffles
  console.log('Creando productos de waffles...');
  const waffleSencillo = await prisma.producto.upsert({
    where: { sku: 'WAF-SEN' },
    update: {},
    create: {
      sku: 'WAF-SEN',
      nombre: 'Waffle Sencillo',
      descripcion: 'Waffle con dos bolas de helado',
      categoriaId: categoriaWaffles.id,
      precioBase: new Prisma.Decimal(5.50),
      codigoIVA: '2',
      activo: true,
    },
  });

  const waffleEspecial = await prisma.producto.upsert({
    where: { sku: 'WAF-ESP' },
    update: {},
    create: {
      sku: 'WAF-ESP',
      nombre: 'Waffle Especial',
      descripcion: 'Waffle con tres bolas de helado y toppings',
      categoriaId: categoriaWaffles.id,
      precioBase: new Prisma.Decimal(7.50),
      codigoIVA: '2',
      activo: true,
    },
  });

  // 11. Crear Productos - Conos
  console.log('Creando productos de conos...');
  const conoSimple = await prisma.producto.upsert({
    where: { sku: 'CON-SIM' },
    update: {},
    create: {
      sku: 'CON-SIM',
      nombre: 'Cono Simple',
      descripcion: 'Cono de helado de un sabor',
      categoriaId: categoriaConos.id,
      precioBase: new Prisma.Decimal(2.00),
      codigoIVA: '2',
      activo: true,
    },
  });

  const conoDoble = await prisma.producto.upsert({
    where: { sku: 'CON-DOB' },
    update: {},
    create: {
      sku: 'CON-DOB',
      nombre: 'Cono Doble',
      descripcion: 'Cono de helado de dos sabores',
      categoriaId: categoriaConos.id,
      precioBase: new Prisma.Decimal(3.00),
      codigoIVA: '2',
      activo: true,
    },
  });

  console.log('✓ Productos creados');

  // 12. Asignar productos a locales
  console.log('Asignando productos a locales...');
  const productos = [
    heladoSimple,
    heladoDoble,
    heladoTriple,
    salpiconPequeno,
    salpiconGrande,
    waffleSencillo,
    waffleEspecial,
    conoSimple,
    conoDoble,
  ];

  for (const producto of productos) {
    // Local 1
    await prisma.productoLocal.upsert({
      where: {
        productoId_localId: {
          productoId: producto.id,
          localId: local1.id,
        },
      },
      update: {},
      create: {
        productoId: producto.id,
        localId: local1.id,
        disponible: true,
        stock: null, // Sin control de stock
        stockMinimo: null,
        precioLocal: null, // Usa precioBase
      },
    });

    // Local 2 - con algunos precios diferentes
    const precioLocal = producto.sku === 'WAF-ESP' ? 8.00 : null; // Waffle especial más caro en local 2

    await prisma.productoLocal.upsert({
      where: {
        productoId_localId: {
          productoId: producto.id,
          localId: local2.id,
        },
      },
      update: {},
      create: {
        productoId: producto.id,
        localId: local2.id,
        disponible: true,
        stock: null,
        stockMinimo: null,
        precioLocal: precioLocal ? new Prisma.Decimal(precioLocal) : null,
      },
    });
  }

  console.log('✓ Productos asignados a locales');

  console.log('✅ Seed completado exitosamente!');
  console.log('');
  console.log('📊 Resumen:');
  console.log(`   - 2 Locales`);
  console.log(`   - 2 Colaboradores`);
  console.log(`   - 4 Categorías`);
  console.log(`   - ${sabores.length} Sabores`);
  console.log(`   - ${toppings.length} Toppings`);
  console.log(`   - ${aderezos.length} Aderezos`);
  console.log(`   - ${sustituciones.length} Sustituciones`);
  console.log(`   - ${productos.length} Productos`);
  console.log(`   - ${productos.length * 2} Asignaciones Producto-Local`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error ejecutando seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
