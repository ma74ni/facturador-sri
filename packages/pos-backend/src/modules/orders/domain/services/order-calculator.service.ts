import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TipoOrden } from '../../application/dto/create-order.dto';

export interface ItemCalculation {
  precioUnitario: number;
  precioModificadores: number;
  subtotalItem: number;
}

export interface OrderCalculation {
  subtotal: number;
  recargoPorcentaje: number;
  recargoMonto: number;
  deliveryFee: number;
  total: number;
}

@Injectable()
export class OrderCalculatorService {
  private readonly recargoLlevar: number;
  private readonly recargoDelivery: number;
  private readonly deliveryFee: number;

  constructor(private readonly configService: ConfigService) {
    this.recargoLlevar = this.configService.get<number>('recargos.llevar', 0.10);
    this.recargoDelivery = this.configService.get<number>('recargos.delivery', 0.20);
    this.deliveryFee = this.configService.get<number>('recargos.deliveryFee', 2.00);
  }

  /**
   * Calcular subtotal de un item (precio base + modificadores)
   */
  calculateItemSubtotal(
    precioBase: number,
    cantidad: number,
    modificadores: {
      sabores?: Array<{ precio?: number }>;
      toppings?: Array<{ precio?: number }>;
      aderezos?: Array<{ precio?: number }>;
      sustituciones?: Array<{ precio?: number }>;
    },
  ): ItemCalculation {
    // Sumar precios de todos los modificadores
    let precioModificadores = 0;

    if (modificadores.sabores) {
      precioModificadores += modificadores.sabores.reduce(
        (sum, s) => sum + (s.precio || 0),
        0,
      );
    }

    if (modificadores.toppings) {
      precioModificadores += modificadores.toppings.reduce(
        (sum, t) => sum + (t.precio || 0),
        0,
      );
    }

    if (modificadores.aderezos) {
      precioModificadores += modificadores.aderezos.reduce(
        (sum, a) => sum + (a.precio || 0),
        0,
      );
    }

    if (modificadores.sustituciones) {
      precioModificadores += modificadores.sustituciones.reduce(
        (sum, s) => sum + (s.precio || 0),
        0,
      );
    }

    const precioUnitario = precioBase + precioModificadores;
    const subtotalItem = precioUnitario * cantidad;

    return {
      precioUnitario: this.roundToTwo(precioUnitario),
      precioModificadores: this.roundToTwo(precioModificadores),
      subtotalItem: this.roundToTwo(subtotalItem),
    };
  }

  /**
   * Calcular total de la orden (subtotal + recargos + delivery fee)
   */
  calculateOrderTotal(
    subtotal: number,
    tipo: TipoOrden,
  ): OrderCalculation {
    let recargoPorcentaje = 0;
    let recargoMonto = 0;
    let deliveryFee = 0;

    // Aplicar recargo según tipo
    if (tipo === 'LLEVAR') {
      recargoPorcentaje = this.recargoLlevar;
      recargoMonto = subtotal * recargoPorcentaje;
    } else if (tipo === 'DELIVERY') {
      recargoPorcentaje = this.recargoDelivery;
      recargoMonto = subtotal * recargoPorcentaje;
      deliveryFee = this.deliveryFee;
    }

    const total = subtotal + recargoMonto + deliveryFee;

    return {
      subtotal: this.roundToTwo(subtotal),
      recargoPorcentaje: this.roundToTwo(recargoPorcentaje),
      recargoMonto: this.roundToTwo(recargoMonto),
      deliveryFee: this.roundToTwo(deliveryFee),
      total: this.roundToTwo(total),
    };
  }

  /**
   * Calcular cambio para un pago
   */
  calculateChange(total: number, montoPagado: number): number {
    const cambio = montoPagado - total;
    return this.roundToTwo(Math.max(0, cambio));
  }

  /**
   * Redondear a 2 decimales
   */
  private roundToTwo(num: number): number {
    return Math.round(num * 100) / 100;
  }

  /**
   * Calcular totales de múltiples items
   */
  calculateItemsSubtotal(
    items: Array<{
      precioUnitario: number;
      cantidad: number;
    }>,
  ): number {
    const subtotal = items.reduce(
      (sum, item) => sum + item.precioUnitario * item.cantidad,
      0,
    );
    return this.roundToTwo(subtotal);
  }
}
