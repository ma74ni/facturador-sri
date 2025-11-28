// Enums
export enum TipoOrden {
  AQUI = 'AQUI',
  LLEVAR = 'LLEVAR',
  DELIVERY = 'DELIVERY',
}

export enum EstadoOrden {
  NEW = 'NEW',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERING = 'DELIVERING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  MIXTO = 'MIXTO',
}

export enum EstadoTurno {
  ABIERTO = 'ABIERTO',
  CERRADO = 'CERRADO',
}

// Models
export interface Local {
  id: string;
  nombre: string;
  codigo: string;
  direccion: string;
  telefono?: string;
  activo: boolean;
  // Relación con facturacion-core
  companyId: string;
  establishmentCode: string;
  emissionPointCode: string;
  // Configuración de impresoras
  printerComanda?: string;
  printerTicket?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Colaborador {
  id: string;
  nombre: string;
  apellido?: string;
  color: string;
  pin?: string;
  activo: boolean;
  localId: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Categoria {
  id: string;
  nombre: string;
  codigo: string;
  color: string;
  icono?: string;
  orden: number;
  activa: boolean;

  // Configuración de modificadores permitidos
  permiteSeleccionarSabores: boolean;
  cantidadSaboresObligatorios?: number;
  cantidadSaboresMax?: number;

  permiteSeleccionarToppings: boolean;
  cantidadToppingsMax?: number;

  permiteSeleccionarAderezos: boolean;
  cantidadAderezosMax?: number;

  permiteSustituciones: boolean;

  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion?: string;
  sku: string;
  precioBase: number;
  categoriaId: string;
  categoria?: Categoria;

  // Facturación
  facturacionProductId?: string;
  codigoIVA: string;

  activo: boolean;

  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export enum TipoModificador {
  SABOR = 'SABOR',
  TOPPING = 'TOPPING',
  ADEREZO = 'ADEREZO',
  SUSTITUCION = 'SUSTITUCION',
}

export interface Modificador {
  id: string;
  tipo: TipoModificador;
  nombre: string;
  descripcion?: string;
  precioAdicional?: number;
  disponible: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface OrderItem {
  id?: string;
  orderId?: string;
  productoId: string;

  // Snapshot del producto
  nombreProducto: string;
  precioUnitario: number;
  cantidad: number;

  // Modificadores seleccionados (JSON en Prisma, arrays aquí para facilidad de uso)
  sabores?: any;
  toppings?: any;
  aderezos?: any;
  sustituciones?: any;

  // Total del item
  subtotalItem: number;

  // Para pedidos incrementales
  etiquetaIncremental?: string;
  esIncremental?: boolean;
  pagado?: boolean;

  // Notas específicas del item
  notas?: string;

  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Order {
  id?: string;
  numeroSecuencial: number;
  numeroMesa?: string;

  localId: string;
  turnoId: string;
  colaboradorId: string;

  // Tipo y estado
  tipo: TipoOrden;
  estado: EstadoOrden;

  // Montos
  subtotal: number;
  recargoPorcentaje: number;
  recargoMonto: number;
  deliveryFee: number;
  total: number;

  // Pago
  metodoPago?: MetodoPago;
  montoPagado?: number;
  montoCambio?: number;
  cambio?: number;
  fechaPago?: string | Date;

  // Facturación
  requiereFactura: boolean;
  invoiceQueued?: boolean;
  facturacionCustomerId?: string;
  clienteNombre?: string;
  clienteIdentificacion?: string;
  clienteEmail?: string;
  clienteTelefono?: string;

  // Items y notas
  items: OrderItem[];
  notas?: string;

  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Turno {
  id: string;
  numeroSecuencial: number;
  estado: EstadoTurno;
  colaboradorId: string;
  localId: string;

  // Apertura
  horaApertura: string | Date;
  efectivoInicial: number;

  // Cierre
  horaCierre?: string | Date;
  efectivoEsperado?: number;
  efectivoReal?: number;
  diferencia?: number;
  notasCierre?: string;

  // Totales calculados
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
  totalVentas: number;
  cantidadOrdenes: number;
  numeroVentas: number;

  createdAt?: string | Date;
  updatedAt?: string | Date;

  // Relaciones opcionales
  local?: Local;
  colaborador?: Colaborador;
}
