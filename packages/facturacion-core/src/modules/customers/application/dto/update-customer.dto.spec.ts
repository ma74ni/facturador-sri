import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateCustomerDto } from './update-customer.dto';

// El mismo pipe que main.ts
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const metadata: ArgumentMetadata = { type: 'body', metatype: UpdateCustomerDto };

describe('UpdateCustomerDto.retentionPercentage', () => {
  it('acepta el porcentaje como texto, tal como lo devuelve la API, y lo convierte a número', async () => {
    const dto = await pipe.transform({ retentionPercentage: '2' }, metadata);
    expect(dto.retentionPercentage).toBe(2);
  });

  it('rechaza valores fuera de 0-100 con un mensaje en español', async () => {
    const error = await pipe.transform({ retentionPercentage: '150' }, metadata).catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toMatchObject({ message: ['El % de retención no puede ser mayor a 100'] });
  });

  it('sigue siendo opcional', async () => {
    const dto = await pipe.transform({ email: 'a@b.ec' }, metadata);
    expect(dto.retentionPercentage).toBeUndefined();
  });
});
