
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = 'tu-secret-super-seguro-cambiar-en-produccion';

async function generateToken() {
  try {
    // 1. Find a user (admin preferably)
    const user = await prisma.user.findFirst();

    if (!user) {
      console.error('❌ No users found in database. Please register a company first.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (${user.id})`);

    // 2. Generate Token
    const payload = { sub: user.id };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    console.log('\nCopy this token to your .env file:');
    console.log('================================================');
    console.log(token);
    console.log('================================================');

  } catch (error) {
    console.error('Error generating token:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateToken();
