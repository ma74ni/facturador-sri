import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('❌ Por favor proporciona un ID de usuario');
    console.log('Uso: tsx scripts/verify-user-email.ts <userId>');
    process.exit(1);
  }

  console.log(`Verificando email para usuario: ${userId}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    console.error(`❌ Usuario no encontrado: ${userId}`);
    process.exit(1);
  }

  console.log('\nUsuario encontrado:');
  console.log(`  Email: ${user.email}`);
  console.log(`  Nombre: ${user.firstName} ${user.lastName}`);
  console.log(`  Email verificado: ${user.emailVerified ? '✅ Sí' : '❌ No'}`);

  if (user.emailVerified) {
    console.log('\n✅ El email ya está verificado');
    process.exit(0);
  }

  console.log('\nActualizando emailVerified a true...');

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    },
  });

  console.log('✅ Email verificado exitosamente');
  console.log(`  Email: ${updatedUser.email}`);
  console.log(`  Verificado: ${updatedUser.emailVerified}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
