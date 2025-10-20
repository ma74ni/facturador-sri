import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // 1. Crear empresa de prueba
  const company = await prisma.company.upsert({
    where: { ruc: '1793082815001' },
    update: {},
    create: {
      ruc: '1793082815001',
      businessName: 'Alicia Carrillo e Hijos Heladería Lattia C. L.',
      tradeName: 'Heladería Lattia',
      address: 'Rother e4-23 y Hoppe Norton',
      phone: '0987654321',
      email: 'ventas@lattia.com',
      replyToEmail: 'ventas@lattia.com',
      environment: 'TEST',
      emailProvider: 'SYSTEM',
      hasCertificate: false,
      isActive: true,
    },
  });

  console.log('✅ Empresa creada:', company.businessName);

  // 2. Crear usuario admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@lattia.com' },
    update: {},
    create: {
      email: 'admin@lattia.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Lattia',
      role: 'ADMIN',
      companyId: company.id,
      isActive: true,
    },
  });

  console.log('✅ Usuario creado:', user.email);

  // 3. Crear establecimiento
  const establishment = await prisma.establishment.upsert({
    where: { 
      companyId_code: {
        companyId: company.id,
        code: '001'
      }
    },
    update: {},
    create: {
      code: '001',
      name: 'Matriz',
      address: 'Rother e4-23 y Hoppe Norton',
      phone: '0987654321',
      companyId: company.id,
    },
  });

  console.log('✅ Establecimiento creado:', establishment.name);

  // 4. Crear punto de emisión
  const emissionPoint = await prisma.emissionPoint.upsert({
    where: {
      establishmentId_code: {
        establishmentId: establishment.id,
        code: '020'
      }
    },
    update: {},
    create: {
      code: '020',
      description: 'Punto de venta principal',
      establishmentId: establishment.id,
      invoiceSequence: 1,
    },
  });

  console.log('✅ Punto de emisión creado:', emissionPoint.code);

  // 5. Crear cliente de prueba
  const customer = await prisma.customer.upsert({
    where: {
      companyId_identification: {
        companyId: company.id,
        identification: '1234567890'
      }
    },
    update: {},
    create: {
      identificationType: '05',
      identification: '1234567890',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com',
      phone: '0987654321',
      address: 'Av. Amazonas N23-45, Quito',
      companyId: company.id,
    },
  });

  console.log('✅ Cliente creado:', customer.firstName, customer.lastName);

  // 6. Crear productos de prueba
  const products = await Promise.all([
    prisma.product.upsert({
      where: {
        companyId_mainCode: {
          companyId: company.id,
          mainCode: 'PROD-001'
        }
      },
      update: {},
      create: {
        mainCode: 'PROD-001',
        name: 'Teclado A',
        description: 'Teclado mecánico RGB',
        unitPrice: 110.50,
        taxCode: '2',
        taxPercentageCode: '2',
        companyId: company.id,
      },
    }),
    prisma.product.upsert({
      where: {
        companyId_mainCode: {
          companyId: company.id,
          mainCode: 'PROD-002'
        }
      },
      update: {},
      create: {
        mainCode: 'PROD-002',
        name: 'Teclado B',
        description: 'Teclado inalámbrico',
        unitPrice: 100.00,
        taxCode: '2',
        taxPercentageCode: '2',
        companyId: company.id,
      },
    }),
  ]);

  console.log('✅ Productos creados:', products.length);

  console.log('\n🎉 Seed completado exitosamente!');
  console.log('\n📝 Credenciales de acceso:');
  console.log('Email: admin@lattia.com');
  console.log('Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });