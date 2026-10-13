/**
 * Cifra las secret keys de Mailjet de las empresas que todavía están en texto
 * plano. Idempotente: las ya cifradas se saltan. Usa la misma llave que las
 * claves de certificado; correr una vez por base después de desplegar:
 *
 *   DATABASE_URL=... CERTIFICATE_ENCRYPTION_KEY=... \
 *     npx ts-node scripts/encrypt-mail-secrets.ts
 *
 * Sin correrlo todo sigue funcionando: un valor sin cifrar se lee tal cual.
 */
import { PrismaClient } from '@prisma/client';

import { encryptSecret, isEncrypted, parseKey } from '../src/shared/crypto/secret-cipher';

async function main() {
  const key = parseKey(process.env.CERTIFICATE_ENCRYPTION_KEY);
  if (!key) throw new Error('Falta CERTIFICATE_ENCRYPTION_KEY');

  const prisma = new PrismaClient();
  try {
    const companies = await prisma.company.findMany({
      where: { mailjetSecretKey: { not: null } },
      select: { id: true, ruc: true, mailjetSecretKey: true },
    });
    let done = 0;
    for (const company of companies) {
      const stored = company.mailjetSecretKey!;
      if (isEncrypted(stored)) continue;
      await prisma.company.update({
        where: { id: company.id },
        data: { mailjetSecretKey: encryptSecret(stored, key) },
      });
      done += 1;
      console.log(`Cifrada la secret key de Mailjet de ${company.ruc}`);
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
