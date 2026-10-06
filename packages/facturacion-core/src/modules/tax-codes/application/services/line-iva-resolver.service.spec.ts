import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../../../shared/database/prisma.service';
import { LineIvaResolverService } from './line-iva-resolver.service';

describe('LineIvaResolverService', () => {
  const products = [
    { id: 'p-gas', mainCode: 'AGUA-GAS', taxPercentageCode: '4' },
    { id: 'p-sin', mainCode: 'AGUA-SIN-GAS', taxPercentageCode: '0' },
    { id: 'p-old', mainCode: 'VIEJO', taxPercentageCode: '2' }, // 12 %, histórico
  ];
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue(products) },
  } as unknown as PrismaService;
  const resolver = new LineIvaResolverService(prisma);

  it('usa la tarifa del producto, por id o por código', async () => {
    await expect(
      resolver.resolve('c1', [
        { mainCode: 'X', productId: 'p-gas' },
        { mainCode: 'AGUA-SIN-GAS' },
      ]),
    ).resolves.toEqual(['4', '0']);
  });

  it('la tarifa explícita de la línea manda sobre la del producto', async () => {
    await expect(
      resolver.resolve('c1', [{ mainCode: 'AGUA-GAS', taxPercentageCode: '0' }]),
    ).resolves.toEqual(['0']);
  });

  it('la tarifa heredada (factura original) manda sobre la del producto', async () => {
    await expect(
      resolver.resolve('c1', [{ mainCode: 'AGUA-GAS' }], new Map([['AGUA-GAS', '5']])),
    ).resolves.toEqual(['5']);
  });

  it('busca los productos solo de la empresa', async () => {
    await resolver.resolve('empresa-7', [{ mainCode: 'AGUA-GAS' }]);
    expect(prisma.product.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'empresa-7' }) }),
    );
  });

  it('rechaza una línea sin tarifa conocida en vez de suponer 15 %', async () => {
    await expect(resolver.resolve('c1', [{ mainCode: 'NO-EXISTE' }])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza una tarifa histórica en un comprobante nuevo', async () => {
    await expect(resolver.resolve('c1', [{ mainCode: 'VIEJO' }])).rejects.toThrow(
      /Línea 1: Código de IVA no válido/,
    );
  });
});
