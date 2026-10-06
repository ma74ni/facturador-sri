/**
 * Cifra las claves de certificado que todavía están en texto plano.
 * Idempotente: las ya cifradas se saltan. Correr una vez por base, después de
 * configurar CERTIFICATE_ENCRYPTION_KEY en el servicio (la misma llave):
 *
 *   DATABASE_URL=... CERTIFICATE_ENCRYPTION_KEY=... \
 *     npx ts-node scripts/encrypt-certificate-passwords.ts
 */
import { PrismaClient } from '@prisma/client';

import { encryptSecret, isEncrypted, parseKey } from '../src/shared/crypto/secret-cipher';

async function main() {
  const key = parseKey(process.env.CERTIFICATE_ENCRYPTION_KEY);
  if (!key) throw new Error('Falta CERTIFICATE_ENCRYPTION_KEY');

  const prisma = new PrismaClient();
  try {
    const companies = await prisma.company.findMany({
      where: { certificatePassword: { not: null } },
      select: { id: true, ruc: true, certificatePassword: true },
    });
    let done = 0;
    for (const company of companies) {
      const stored = company.certificatePassword!;
      if (isEncrypted(stored)) continue;
      await prisma.company.update({
        where: { id: company.id },
        data: { certificatePassword: encryptSecret(stored, key) },
      });
      done += 1;
      console.log(`Cifrada la clave de ${company.ruc}`);
    }
    console.log(`Listo: ${done} cifradas, ${companies.length - done} ya estaban cifradas.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
