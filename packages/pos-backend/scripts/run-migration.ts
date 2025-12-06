import { PrismaClient } from '../node_modules/.prisma/client-pos';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('Aplicando migración: add_facturacion_auth_fields...');

  try {
    // Add columns to colaboradores
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "pos"."colaboradores"
      ADD COLUMN IF NOT EXISTS "facturacionUserId" TEXT,
      ADD COLUMN IF NOT EXISTS "facturacionEmail" TEXT,
      ADD COLUMN IF NOT EXISTS "requiresFacturacionAuth" BOOLEAN NOT NULL DEFAULT false;
    `);

    // Add columns to turnos
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "pos"."turnos"
      ADD COLUMN IF NOT EXISTS "facturacionToken" TEXT,
      ADD COLUMN IF NOT EXISTS "facturacionTokenExpiry" TIMESTAMP(3);
    `);

    // Create unique indexes if they don't exist
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "colaboradores_facturacionUserId_key"
      ON "pos"."colaboradores"("facturacionUserId");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "colaboradores_facturacionEmail_key"
      ON "pos"."colaboradores"("facturacionEmail");
    `);

    console.log('✅ Migración aplicada exitosamente!');
  } catch (error) {
    console.error('❌ Error aplicando migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
