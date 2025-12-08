import { Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  OrderCannotBeModifiedException,
} from '@shared/exceptions/custom-exceptions';
import { EstadoOrden } from '../../application/dto/update-order.dto';

@Injectable()
export class OrderValidatorService {
  /**
   * Validar si una orden puede ser modificada (añadir/eliminar items)
   */
  canModifyItems(estado: EstadoOrden): boolean {
    // Solo se pueden modificar órdenes en estado NEW o PAID
    const estadosPermitidos: EstadoOrden[] = [EstadoOrden.NEW, EstadoOrden.PAID];
    return estadosPermitidos.includes(estado);
  }

  /**
   * Validar si una orden puede ser cancelada
   */
  canBeCancelled(estado: EstadoOrden): boolean {
    // No se pueden cancelar órdenes ya entregadas o canceladas
    const estadosNoPermitidos: EstadoOrden[] = [
      EstadoOrden.DELIVERED,
      EstadoOrden.CANCELLED,
    ];
    return !estadosNoPermitidos.includes(estado);
  }

  /**
   * Validar si una orden puede ser pagada
   */
  canBePaid(estado: EstadoOrden): boolean {
    // Solo se pueden pagar órdenes en estado NEW
    return estado === EstadoOrden.NEW;
  }

  /**
   * Validar transición de estado
   */
  validateStateTransition(
    currentState: EstadoOrden,
    newState: EstadoOrden,
  ): void {
    const validTransitions: Record<EstadoOrden, EstadoOrden[]> = {
      [EstadoOrden.NEW]: [EstadoOrden.PAID, EstadoOrden.CANCELLED],
      [EstadoOrden.PAID]: [EstadoOrden.PREPARING, EstadoOrden.CANCELLED],
      [EstadoOrden.PREPARING]: [EstadoOrden.READY, EstadoOrden.CANCELLED],
      [EstadoOrden.READY]: [
        EstadoOrden.DELIVERING,
        EstadoOrden.DELIVERED,
        EstadoOrden.CANCELLED,
      ],
      [EstadoOrden.DELIVERING]: [EstadoOrden.DELIVERED, EstadoOrden.CANCELLED],
      [EstadoOrden.DELIVERED]: [], // Estado final
      [EstadoOrden.CANCELLED]: [], // Estado final
    };

    const allowedStates = validTransitions[currentState] || [];

    if (!allowedStates.includes(newState)) {
      throw new OrderCannotBeModifiedException(
        `No se puede cambiar de ${currentState} a ${newState}`,
      );
    }
  }

  /**
   * Validar que el monto pagado sea suficiente
   */
  validatePaymentAmount(total: number, montoPagado: number): void {
    if (montoPagado < total) {
      throw new BusinessRuleException(
        `El monto pagado ($${montoPagado.toFixed(2)}) es insuficiente. Total: $${total.toFixed(2)}`,
      );
    }
  }

  /**
   * Validar que la orden tenga items
   */
  validateHasItems(itemsCount: number): void {
    if (itemsCount === 0) {
      throw new BusinessRuleException(
        'La orden debe tener al menos un item',
      );
    }
  }

  /**
   * Validar que se puede realizar pedido incremental
   */
  validateCanAddIncremental(estado: EstadoOrden): void {
    // Solo se pueden añadir items incrementales a órdenes PAID o posteriores
    const estadosPermitidos: EstadoOrden[] = [
      EstadoOrden.PAID,
      EstadoOrden.PREPARING,
      EstadoOrden.READY,
      EstadoOrden.DELIVERING,
    ];

    if (!estadosPermitidos.includes(estado)) {
      throw new OrderCannotBeModifiedException(
        'Solo se pueden añadir items incrementales a órdenes ya pagadas',
      );
    }
  }
}
