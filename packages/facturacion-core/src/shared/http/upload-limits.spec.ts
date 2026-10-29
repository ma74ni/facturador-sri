import { Controller, INestApplication, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { CERTIFICATE_UPLOAD } from './upload-limits';

@Controller('upload')
class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file', CERTIFICATE_UPLOAD))
  upload(@UploadedFile() file: Express.Multer.File) {
    return { size: file.size };
  }
}

describe('Límites de subida', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [UploadController] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('acepta un archivo dentro del tope', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .attach('file', Buffer.alloc(10 * 1024), 'firma.p12')
      .expect(201, { size: 10 * 1024 });
  });

  it('rechaza con 413 un archivo por encima del tope sin cargarlo entero', async () => {
    await request(app.getHttpServer())
      .post('/upload')
      .attach('file', Buffer.alloc(2 * 1024 * 1024), 'firma.p12')
      .expect(413);
  });
});
