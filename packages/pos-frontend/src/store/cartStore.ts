import { create } from 'zustand';
import type { OrderItem } from '@/lib/types';
import { TipoOrden } from '@/lib/types';
import { calculateCartTotals } from '@/lib/utils/cartCalculations';

interface CartState {
  items: OrderItem[];
  tipo: TipoOrden;
  numeroMesa?: string;
  notas?: string;

  // Incremental order mode
  isIncrementalMode: boolean;
  incrementalOrderId?: string;

  // Actions
  addItem: (item: OrderItem) => void;
  removeItem: (index: number) => void;
  updateItemQuantity: (index: number, cantidad: number) => void;
  clearCart: () => void;
  setTipo: (tipo: TipoOrden) => void;
  setNumeroMesa: (numeroMesa?: string) => void;
  setNotas: (notas?: string) => void;

  // Incremental mode actions
  enableIncrementalMode: (orderId: string) => void;
  disableIncrementalMode: () => void;

  // Computed
  getSubtotal: () => number;
  getItemCount: () => number;
  getTotals: () => {
    subtotal: number;
    recargoPorcentaje: number;
    recargoMonto: number;
    deliveryFee: number;
    total: number;
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  tipo: TipoOrden.AQUI,
  numeroMesa: undefined,
  notas: undefined,
  isIncrementalMode: false,
  incrementalOrderId: undefined,

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),

  removeItem: (index) =>
    set((state) => ({
      items: state.items.filter((_, i) => i !== index),
    })),

  updateItemQuantity: (index, cantidad) =>
    set((state) => {
      const newItems = [...state.items];
      if (newItems[index]) {
        newItems[index] = {
          ...newItems[index],
          cantidad,
          subtotalItem: newItems[index].precioUnitario * cantidad,
        };
      }
      return { items: newItems };
    }),

  clearCart: () =>
    set({
      items: [],
      numeroMesa: undefined,
      notas: undefined,
      isIncrementalMode: false,
      incrementalOrderId: undefined,
    }),

  setTipo: (tipo) => set({ tipo }),

  setNumeroMesa: (numeroMesa) => set({ numeroMesa }),

  setNotas: (notas) => set({ notas }),

  enableIncrementalMode: (orderId) =>
    set({
      isIncrementalMode: true,
      incrementalOrderId: orderId,
      items: [], // Start with empty cart for incremental items
    }),

  disableIncrementalMode: () =>
    set({
      isIncrementalMode: false,
      incrementalOrderId: undefined,
    }),

  getSubtotal: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.subtotalItem, 0);
  },

  getItemCount: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.cantidad, 0);
  },

  getTotals: () => {
    const { tipo } = get();
    const subtotal = get().getSubtotal();
    return calculateCartTotals(subtotal, tipo);
  },
}));
