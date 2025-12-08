import apiClient from './client';
import type { Producto, Categoria, Modificador, TipoModificador, ProductoLocal } from '../types';

// ============================================
// PRODUCTOS API
// ============================================

export interface CreateProductoDto {
  nombre: string;
  descripcion?: string;
  sku: string;

  // Sistema de precios múltiples
  precioBase: number; // DEPRECATED: mantener por compatibilidad
  precioParaServir: number;
  precioParaLlevar: number;
  precioDelivery?: number;
  precioIncluyeIVA?: boolean;

  categoriaId: string;
  facturacionProductId?: string;
  codigoIVA?: string;
  imagenUrl?: string;
  imagenPath?: string;
  activo?: boolean;
  esCombo?: boolean;
}

export interface UpdateProductoDto extends Partial<CreateProductoDto> {}

export interface AssignProductoLocalDto {
  productoId: string;
  localId: string;
  disponible?: boolean;
  stock?: number;
  stockMinimo?: number;
  precioLocal?: number;
}

export const productosApi = {
  // Listar todos los productos
  async getAll(): Promise<Producto[]> {
    const response = await apiClient.get('/productos');
    return response.data;
  },

  // Listar productos activos
  async getActive(): Promise<Producto[]> {
    const response = await apiClient.get('/productos/active');
    return response.data;
  },

  // Listar productos por local
  async getByLocal(localId: string): Promise<Producto[]> {
    const response = await apiClient.get(`/productos/local/${localId}`);
    return response.data;
  },

  // Obtener un producto específico
  async getById(id: string): Promise<Producto> {
    const response = await apiClient.get(`/productos/${id}`);
    return response.data;
  },

  // Crear producto
  async create(data: CreateProductoDto): Promise<Producto> {
    const response = await apiClient.post('/productos', data);
    return response.data;
  },

  // Actualizar producto
  async update(id: string, data: UpdateProductoDto): Promise<Producto> {
    const response = await apiClient.patch(`/productos/${id}`, data);
    return response.data;
  },

  // Eliminar producto (soft delete)
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/productos/${id}`);
  },

  // Asignar producto a local
  async assignToLocal(data: AssignProductoLocalDto): Promise<ProductoLocal> {
    const response = await apiClient.post('/productos/assign-local', data);
    return response.data;
  },
};

// ============================================
// CATEGORÍAS API
// ============================================

export interface CreateCategoriaDto {
  nombre: string;
  codigo: string;
  color?: string;
  icono?: string;
  orden?: number;
  permiteSeleccionarSabores?: boolean;
  cantidadSaboresObligatorios?: number;
  cantidadSaboresMax?: number;
  permiteSeleccionarToppings?: boolean;
  cantidadToppingsMax?: number;
  permiteSeleccionarAderezos?: boolean;
  cantidadAderezosMax?: number;
  permiteSustituciones?: boolean;
  activa?: boolean;
}

export interface UpdateCategoriaDto extends Partial<CreateCategoriaDto> {}

export const categoriasApi = {
  // Listar todas
  async getAll(): Promise<Categoria[]> {
    const response = await apiClient.get('/categorias');
    return response.data;
  },

  // Listar activas
  async getActive(): Promise<Categoria[]> {
    const response = await apiClient.get('/categorias/active');
    return response.data;
  },

  // Obtener por ID
  async getById(id: string): Promise<Categoria> {
    const response = await apiClient.get(`/categorias/${id}`);
    return response.data;
  },

  // Crear categoría
  async create(data: CreateCategoriaDto): Promise<Categoria> {
    const response = await apiClient.post('/categorias', data);
    return response.data;
  },

  // Actualizar categoría
  async update(id: string, data: UpdateCategoriaDto): Promise<Categoria> {
    const response = await apiClient.patch(`/categorias/${id}`, data);
    return response.data;
  },

  // Eliminar categoría (soft delete)
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/categorias/${id}`);
  },
};

// ============================================
// MODIFICADORES API
// ============================================

export interface CreateModificadorDto {
  tipo: TipoModificador;
  nombre: string;
  descripcion?: string;
  precioAdicional?: number;
  disponible?: boolean;
}

export interface UpdateModificadorDto extends Partial<CreateModificadorDto> {}

export const modificadoresApi = {
  // Listar todos
  async getAll(): Promise<Modificador[]> {
    const response = await apiClient.get('/modificadores');
    return response.data;
  },

  // Listar disponibles
  async getDisponibles(): Promise<Modificador[]> {
    const response = await apiClient.get('/modificadores/disponibles');
    return response.data;
  },

  // Listar agrupados por tipo
  async getGrouped(): Promise<Record<TipoModificador, Modificador[]>> {
    const response = await apiClient.get('/modificadores/grouped');
    return response.data;
  },

  // Filtrar por tipo
  async getByTipo(tipo: TipoModificador): Promise<Modificador[]> {
    const response = await apiClient.get(`/modificadores/tipo/${tipo}`);
    return response.data;
  },

  // Obtener por ID
  async getById(id: string): Promise<Modificador> {
    const response = await apiClient.get(`/modificadores/${id}`);
    return response.data;
  },

  // Crear modificador
  async create(data: CreateModificadorDto): Promise<Modificador> {
    const response = await apiClient.post('/modificadores', data);
    return response.data;
  },

  // Actualizar modificador
  async update(id: string, data: UpdateModificadorDto): Promise<Modificador> {
    const response = await apiClient.patch(`/modificadores/${id}`, data);
    return response.data;
  },

  // Eliminar modificador (soft delete)
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/modificadores/${id}`);
  },
};
