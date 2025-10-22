import { Global, Module } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { R2StorageService } from './storage/r2-storage.service';

@Global()
@Module({
  providers: [PrismaService, R2StorageService],
  exports: [PrismaService, R2StorageService],
})
export class SharedModule {}
