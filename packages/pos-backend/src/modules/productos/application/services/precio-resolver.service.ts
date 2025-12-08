import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { TipoOrden } from '@prisma/client-pos';

/**
 * Servicio para resolver el precio efectivo de un producto en un local específico
 *
 * ## Responsabilidad Única (Single Responsibility):
 * Este servicio tiene una única responsabilidad: determinar qué precio se debe
 * aplicar a un producto considerando el tipo de orden y la configuración de precios
 * tanto a nivel de local como a nivel central.
 *
 * ## Lógica de Resolución:
 * 1. Si el producto tiene precio local configurado para el tipo de orden → usar precio local
 * 2. Si no hay precio local → usar precio del catálogo central
 * 3. Caso especial DELIVERY: si no hay precioLocalDelivery ni precioDelivery central
 *    → fallback a precioLocalParaLlevar o precioParaLlevar
 *
 * ## Ejemplo de Uso:
 * ```typescript
 * const precio = await precioResolver.resolverPrecio(
 *   'producto-uuid-123',
 *   'local-uuid-456',
 *   TipoOrden.AQUI
 * );
 * ```
 */
@Injectable()
export class PrecioResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resuelve el precio efectivo de un producto para un local y tipo de orden específicos
   *
   * @param productoId - ID del producto en el catálogo central
   * @param localId - ID del local donde se vende el producto
   * @param tipoOrden - Tipo de orden (AQUI, LLEVAR, DELIVERY)
   * @returns El precio efectivo a aplicar
   * @throws {NotFoundException} Si el producto no existe o no está disponible en el local
   *
   * @example
   * ```typescript
   * // Producto con precio local diferenciado
   * const precio = await this.precioResolver.resolverPrecio(
   *   'prod-123',
   *   'local-norte',
   *   TipoOrden.AQUI
   * );
   * // Retorna: 3.50 (precio local) en lugar de 3.00 (precio central)
   *
   * // Producto sin precio local (usa precio central)
   * const precio = await this.precioResolver.resolverPrecio(
   *   'prod-456',
   *   'local-sur',
   *   TipoOrden.LLEVAR
   * );
   * // Retorna: 2.50 (precio central)
   * ```
   */
  async resolverPrecio(
    productoId: string,
    localId: string,
    tipoOrden: TipoOrden,
  ): Promise<number> {
    // Obtener producto con su configuración de local
    const productoLocal = await this.prisma.productoLocal.findUnique({
      where: {
        productoId_localId: {
          productoId,
          localId,
        },
      },
      include: {
        producto: true,
      },
    });

    // Validar que el producto exista y esté disponible en el local
    if (!productoLocal) {
      throw new NotFoundException(
        `Producto ${productoId} no encontrado en local ${localId}`,
      );
    }

    if (!productoLocal.disponible) {
      throw new NotFoundException(
        `Producto ${productoId} no está disponible en local ${localId}`,
      );
    }

    if (!productoLocal.producto.activo) {
      throw new NotFoundException(
        `Producto ${productoId} está desactivado en el catálogo central`,
      );
    }

    // Resolver precio según tipo de orden
    return this.getPrecioByTipoOrden(productoLocal, tipoOrden);
  }

  /**
   * Obtiene el precio apropiado según el tipo de orden
   * Implementa la lógica de fallback: precio local → precio central
   *
   * @private
   * @param productoLocal - Producto con información de local y catálogo central
   * @param tipoOrden - Tipo de orden
   * @returns El precio efectivo
   */
  private getPrecioByTipoOrden(
    productoLocal: any,
    tipoOrden: TipoOrden,
  ): number {
    const { producto } = productoLocal;

    switch (tipoOrden) {
      case TipoOrden.AQUI:
        // Precio local para servir → Precio central para servir
        return this.toNumber(
          productoLocal.precioLocalParaServir ?? producto.precioParaServir,
        );

      case TipoOrden.LLEVAR:
        // Precio local para llevar → Precio central para llevar
        return this.toNumber(
          productoLocal.precioLocalParaLlevar ?? producto.precioParaLlevar,
        );

      case TipoOrden.DELIVERY:
        // Precio local delivery → Precio central delivery → Precio para llevar
        // Algunos productos pueden no tener precio delivery configurado,
        // en ese caso se usa el precio para llevar como fallback
        return this.toNumber(
          productoLocal.precioLocalDelivery ??
            producto.precioDelivery ??
            productoLocal.precioLocalParaLlevar ??
            producto.precioParaLlevar,
        );

      default:
        // En caso de un tipo de orden no reconocido, usar precio para servir
        return this.toNumber(
          productoLocal.precioLocalParaServir ?? producto.precioParaServir,
        );
    }
  }

  /**
   * Convierte un Decimal de Prisma a number
   * Prisma retorna Decimal para tipos DECIMAL en la BD
   *
   * @private
   * @param value - Valor Decimal o number
   * @returns Número como number
   */
  private toNumber(value: any): number {
    if (typeof value === 'number') {
      return value;
    }
    // Prisma Decimal tiene método toNumber()
    return Number(value);
  }

  /**
   * Resuelve los precios para todos los tipos de orden de un producto
   * Útil para mostrar en UI o para cálculos batch
   *
   * @param productoId - ID del producto
   * @param localId - ID del local
   * @returns Objeto con precios por tipo de orden
   * @throws {NotFoundException} Si el producto no existe o no está disponible
   *
   * @example
   * ```typescript
   * const precios = await this.precioResolver.resolverTodosLosPrecios(
   *   'prod-123',
   *   'local-norte'
   * );
   * // Retorna:
   * // {
   * //   paraServir: 3.50,
   * //   paraLlevar: 3.00,
   * //   delivery: 3.50
   * // }
   * ```
   */
  async resolverTodosLosPrecios(
    productoId: string,
    localId: string,
  ): Promise<{
    paraServir: number;
    paraLlevar: number;
    delivery: number;
  }> {
    const [paraServir, paraLlevar, delivery] = await Promise.all([
      this.resolverPrecio(productoId, localId, TipoOrden.AQUI),
      this.resolverPrecio(productoId, localId, TipoOrden.LLEVAR),
      this.resolverPrecio(productoId, localId, TipoOrden.DELIVERY),
    ]);

    return {
      paraServir,
      paraLlevar,
      delivery,
    };
  }

  /**
   * Verifica si un producto tiene precios locales diferenciados
   * Útil para mostrar indicadores en la UI
   *
   * @param productoId - ID del producto
   * @param localId - ID del local
   * @returns true si tiene al menos un precio local configurado
   *
   * @example
   * ```typescript
   * const tieneCustomizacion = await this.precioResolver.tienePreciosLocales(
   *   'prod-123',
   *   'local-norte'
   * );
   * // Retorna: true (este local tiene precios diferenciados)
   * ```
   */
  async tienePreciosLocales(
    productoId: string,
    localId: string,
  ): Promise<boolean> {
    const productoLocal = await this.prisma.productoLocal.findUnique({
      where: {
        productoId_localId: {
          productoId,
          localId,
        },
      },
      select: {
        precioLocalParaServir: true,
        precioLocalParaLlevar: true,
        precioLocalDelivery: true,
      },
    });

    if (!productoLocal) {
      return false;
    }

    // Tiene precios locales si al menos uno está configurado (no null)
    return (
      productoLocal.precioLocalParaServir !== null ||
      productoLocal.precioLocalParaLlevar !== null ||
      productoLocal.precioLocalDelivery !== null
    );
  }
}
