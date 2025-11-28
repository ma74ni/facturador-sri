// Enums
export enum TipoOrden {
  AQUI = 'AQUI',
  LLEVAR = 'LLEVAR',
  DELIVERY = 'DELIVERY',
}

export enum EstadoOrden {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  PAID = 'PAID',
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
  direccion: string;
  telefono?: string;
  ciudad: string;
  activo: boolean;
}

export interface Colaborador {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  localId: string;
  activo: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  icono?: string;
  orden: number;
  activo: boolean;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  categoriaId: string;
  categoria?: Categoria;
  disponible: boolean;
  imagen?: string;
}

export interface Modificador {
  id: string;
  nombre: string;
  tipo: 'SABOR' | 'TOPPING' | 'ADEREZO' | 'SUSTITUCION';
  precioAdicional: number;
  disponible: boolean;
}

export interface OrderItem {
  id?: string;
  productoId: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  subtotalItem: number;
  sabores?: string[];
  toppings?: string[];
  aderezos?: string[];
  sustituciones?: string[];
  notas?: string;
  esIncremental?: boolean;
  etiquetaIncremental?: string;
}

export interface Order {
  id?: string;
  numeroSecuencial: number;
  tipo: TipoOrden;
  estado: EstadoOrden;
  numeroMesa?: string;
  items: OrderItem[];
  subtotal: number;
  recargoPorcentaje: number;
  recargoMonto: number;
  deliveryFee: number;
  total: number;
  metodoPago?: MetodoPago;
  montoPagado?: number;
  cambio?: number;
  requiereFactura: boolean;
  clienteNombre?: string;
  clienteIdentificacion?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  notas?: string;
  turnoId: string;
  localId: string;
  colaboradorId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Turno {
  id: string;
  numeroTurno: number;
  estado: EstadoTurno;
  localId: string;
  colaboradorId: string;
  efectivoInicial: number;
  efectivoFinal?: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
  totalVentas: number;
  numeroVentas: number;
  observaciones?: string;
  aperturaAt: Date;
  cierreAt?: Date;
}
