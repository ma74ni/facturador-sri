import { TipoOrden } from '../types';

// Configuración de recargos (debería venir de variables de entorno o configuración)
const RECARGO_LLEVAR = 0.1; // 10%
const RECARGO_DELIVERY = 0.2; // 20%
const DELIVERY_FEE = 2.0; // $2.00

export interface CartTotals {
  subtotal: number;
  recargoPorcentaje: number;
  recargoMonto: number;
  deliveryFee: number;
  total: number;
}

export function calculateCartTotals(
  subtotal: number,
  tipo: TipoOrden
): CartTotals {
  let recargoPorcentaje = 0;
  let recargoMonto = 0;
  let deliveryFee = 0;

  switch (tipo) {
    case TipoOrden.LLEVAR:
      recargoPorcentaje = RECARGO_LLEVAR;
      recargoMonto = subtotal * RECARGO_LLEVAR;
      break;
    case TipoOrden.DELIVERY:
      recargoPorcentaje = RECARGO_DELIVERY;
      recargoMonto = subtotal * RECARGO_DELIVERY;
      deliveryFee = DELIVERY_FEE;
      break;
    case TipoOrden.AQUI:
    default:
      recargoPorcentaje = 0;
      recargoMonto = 0;
      break;
  }

  const total = subtotal + recargoMonto + deliveryFee;

  return {
    subtotal,
    recargoPorcentaje,
    recargoMonto,
    deliveryFee,
    total,
  };
}

export function calculateItemSubtotal(
  precioBase: number,
  cantidad: number,
  modificadores: {
    sabores?: any[];
    toppings?: any[];
    aderezos?: any[];
    sustituciones?: any[];
  }
): number {
  let precioUnitario = precioBase;

  // Sumar precios de modificadores
  if (modificadores.toppings) {
    modificadores.toppings.forEach((topping) => {
      if (topping.precioAdicional) {
        precioUnitario += topping.precioAdicional;
      }
    });
  }

  if (modificadores.aderezos) {
    modificadores.aderezos.forEach((aderezo) => {
      if (aderezo.precioAdicional) {
        precioUnitario += aderezo.precioAdicional;
      }
    });
  }

  return precioUnitario * cantidad;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
