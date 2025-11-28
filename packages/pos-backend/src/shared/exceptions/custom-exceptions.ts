import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Excepción cuando un recurso no es encontrado
 */
export class ResourceNotFoundException extends NotFoundException {
  constructor(resource: string, id: string) {
    super(`${resource} con ID ${id} no encontrado`);
  }
}

/**
 * Excepción cuando hay un conflicto de negocio
 */
export class BusinessRuleException extends ConflictException {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Excepción cuando la caja/turno no está abierto
 */
export class TurnoNotOpenException extends BadRequestException {
  constructor() {
    super('No hay un turno abierto. Por favor abre caja primero');
  }
}

/**
 * Excepción cuando se intenta cerrar una caja que no está abierta
 */
export class TurnoAlreadyClosedException extends BadRequestException {
  constructor() {
    super('El turno ya está cerrado');
  }
}

/**
 * Excepción cuando un producto no está disponible
 */
export class ProductoNotAvailableException extends BadRequestException {
  constructor(productoNombre: string) {
    super(`El producto "${productoNombre}" no está disponible en este local`);
  }
}

/**
 * Excepción cuando no hay stock suficiente
 */
export class InsufficientStockException extends BadRequestException {
  constructor(productoNombre: string, stockDisponible: number) {
    super(
      `Stock insuficiente para "${productoNombre}". Disponible: ${stockDisponible}`,
    );
  }
}

/**
 * Excepción cuando la orden no puede ser modificada
 */
export class OrderCannotBeModifiedException extends BadRequestException {
  constructor(reason: string) {
    super(`La orden no puede ser modificada: ${reason}`);
  }
}

/**
 * Excepción cuando la integración con facturacion-core falla
 */
export class FacturacionIntegrationException extends HttpException {
  constructor(message: string, originalError?: any) {
    super(
      {
        message: `Error en integración con facturación: ${message}`,
        originalError: originalError?.message,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/**
 * Excepción cuando la impresora falla
 */
export class PrinterException extends HttpException {
  constructor(printerName: string, error: string) {
    super(
      {
        message: `Error en impresora ${printerName}`,
        error,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
