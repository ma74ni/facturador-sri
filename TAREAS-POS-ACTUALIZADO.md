# Tareas POS - Sistema Multi-Local para Heladerías

**Última actualización:** 2025-11-28

## Estado General del Proyecto

### ✅ Backend (pos-backend) - COMPLETADO
- ✅ Estructura de módulos NestJS con DDD
- ✅ Schema de Prisma completo
- ✅ Todos los módulos implementados:
  - ✅ Locales
  - ✅ Colaboradores
  - ✅ Turnos
  - ✅ Productos/Categorías/Modificadores
  - ✅ Orders (core del POS)
  - ✅ Delivery
  - ✅ Facturación (integración con facturacion-core)
  - ✅ Printing (impresión térmica)
  - ✅ Reportes

### 🔄 Frontend (pos-frontend) - EN PROGRESO (37.5%)

#### ✅ FASE 1: Pantalla POS Principal - COMPLETADA (100%)
- ✅ Configuración base (React + Vite + TypeScript)
- ✅ TailwindCSS + shadcn/ui
- ✅ Zustand stores (cart, session)
- ✅ React Query
- ✅ Axios client
- ✅ Routing básico
- ✅ LoginScreen (selección local + colaborador)
- ✅ AbrirTurnoScreen (apertura de caja)
- ✅ POSScreen - Catálogo de productos funcional
  - ✅ Grid de categorías con colores e iconos
  - ✅ Grid de productos responsive
  - ✅ Filtrado por categoría y local
- ✅ MainLayout (layout con sidebar)
- ✅ API hooks (useProductos, useOrders, useFacturacion)
- ✅ Cart calculations utilities
- ✅ ModificadoresModal - Personalización de productos completa
  - ✅ Selección de sabores (obligatorios)
  - ✅ Selección de toppings (opcionales con precio)
  - ✅ Selección de aderezos (opcionales con precio)
  - ✅ Sustituciones
  - ✅ Notas
  - ✅ Selector de cantidad
  - ✅ Cálculo dinámico de subtotal
- ✅ CartPanel - Panel lateral del carrito
  - ✅ Lista de items con modificadores
  - ✅ Editar cantidad
  - ✅ Eliminar items
  - ✅ Selector de tipo de orden
  - ✅ Campo número de mesa
  - ✅ Resumen de totales

#### ✅ FASE 2: Sistema de Pago - COMPLETADA (100%)
- ✅ PaymentModal - Interfaz de cobro completa
  - ✅ Mostrar total a cobrar
  - ✅ Selector de método de pago
  - ✅ Calculadora de efectivo con botones rápidos
  - ✅ Cálculo automático de cambio
  - ✅ Checkbox "¿Requiere factura?"
- ✅ Integración con Backend
  - ✅ Hook `usePayOrder` para procesar pago
  - ✅ Crear orden en backend
  - ✅ Actualizar estado del turno
  - ✅ Manejo de errores
  - ✅ Feedback visual (loading, success, error)
- ✅ FacturaDialog - Datos de facturación
  - ✅ Búsqueda de cliente por cédula/RUC
  - ✅ Mostrar datos del cliente encontrado
  - ✅ Formulario para crear cliente nuevo
  - ✅ Integración con API de facturación
  - ✅ Encolar factura en backend

#### ✅ FASE 3: Dashboard de Órdenes - COMPLETADA (100%)

**✅ Implementado:**
- ✅ OrdersPage - Vista de órdenes activas (`packages/pos-frontend/src/features/orders/OrdersPage.tsx`)
  - ✅ Grid de tarjetas de órdenes
  - ✅ Filtros por estado (NEW, PAID, PREPARING, READY, DELIVERING, DELIVERED)
  - ✅ Filtros por tipo (AQUI, LLEVAR, DELIVERY)
  - ✅ Contador de órdenes por estado
  - ✅ Botón de actualización manual
  - ✅ Click en orden abre modal de detalle
  - ✅ **Auto-refresh optimizado** (eliminado para reducir carga del servidor)

- ✅ OrderCard - Tarjeta de orden (`packages/pos-frontend/src/components/orders/OrderCard.tsx`)
  - ✅ Número de orden destacado
  - ✅ Tipo de orden (badge con emoji 🍽️ 🥡 🛵)
  - ✅ Estado de orden (badge con color dinámico)
  - ✅ Total de la orden formateado
  - ✅ Hora de creación (tiempo relativo: "Hace 5 mins")
  - ✅ Mesa (si aplica)
  - ✅ Contador de items
  - ✅ Hover effects y animaciones
  - ✅ Click abre OrderDetailModal

- ✅ **OrderDetailModal** - Vista detallada completa (`packages/pos-frontend/src/features/orders/OrderDetailModal.tsx`)
  - ✅ Vista completa de la orden con toda la información:
    - ✅ Información general (número, mesa, tipo, estado)
    - ✅ Información del colaborador que atendió
    - ✅ Información de pago (método, monto pagado, cambio, fecha)
    - ✅ Lista completa de items con modificadores expandidos:
      - ✅ Nombre del producto y cantidad
      - ✅ Sabores seleccionados
      - ✅ Toppings con precios
      - ✅ Aderezos con precios
      - ✅ Sustituciones
      - ✅ Notas del item
      - ✅ Etiquetas incrementales (-A, -B, etc.)
      - ✅ Subtotal del item
    - ✅ Totales detallados:
      - ✅ Subtotal
      - ✅ Recargo (% y monto)
      - ✅ Delivery fee (si aplica)
      - ✅ Total
    - ✅ Notas de la orden

- ✅ **Cambio de Estados de Orden**
  - ✅ Botones de acción según estado actual con transiciones inteligentes:
    - ✅ NEW → PAID / CANCELLED
    - ✅ PAID → PREPARING / CANCELLED
    - ✅ PREPARING → READY / CANCELLED
    - ✅ READY → DELIVERED / CANCELLED
    - ✅ DELIVERING → DELIVERED / CANCELLED
  - ✅ Integración con hook `useUpdateOrderStatus`
  - ✅ Invalidación automática de cache (actualiza lista)
  - ✅ Feedback visual con toasts
  - ✅ Diseño responsive con scroll interno
  - ✅ Colores contextuales (rojo para cancelar, verde para avanzar)

- ✅ Hooks disponibles
  - ✅ `useOrders(localId)` - Obtener órdenes por local (sin auto-refresh)
  - ✅ `useUpdateOrderStatus()` - Cambiar estado de orden
  - ✅ `useCreateOrder()` - Crear nueva orden
  - ✅ `usePayOrder()` - Procesar pago

- ✅ Routing y navegación
  - ✅ Ruta `/ordenes` configurada en App.tsx
  - ✅ Navegación en Sidebar con icono Receipt

- ✅ **Pedidos Incrementales** - COMPLETADO ⭐
  - ✅ Botón "Añadir Productos" funcional en OrderDetailModal
  - ✅ Cart store con modo incremental:
    - ✅ `isIncrementalMode` y `incrementalOrderId` state
    - ✅ `enableIncrementalMode()` y `disableIncrementalMode()` actions
  - ✅ POSScreen con detección de modo incremental:
    - ✅ Banner azul informativo "Añadiendo productos a orden existente"
    - ✅ Botón "Cancelar y volver" para salir del modo incremental
    - ✅ Título adaptativo según modo
  - ✅ PaymentModal con soporte dual:
    - ✅ Modo normal: Crear orden → Procesar pago
    - ✅ Modo incremental: Añadir items → Saltar pago → Volver a órdenes
    - ✅ UI adaptativa según modo (título, botones, mensajes)
  - ✅ Integración con endpoint backend: `POST /api/v1/orders/:id/items`
  - ✅ Navegación correcta a `/ordenes` después de añadir
  - ✅ Etiquetas incrementales (-A, -B, etc.) generadas automáticamente por backend
  - ✅ Actualización automática de totales de orden

- ✅ **Botones de Impresión** - COMPLETADO
  - ✅ Hook `usePrintComanda()` creado en `usePrintJobs.ts`
  - ✅ Hook `usePrintTicket()` creado en `usePrintJobs.ts`
  - ✅ Hook `usePrintJobs(orderId)` para obtener historial
  - ✅ Hook `useReprintJob()` para reimprimir trabajos fallidos
  - ✅ Integración completa en OrderDetailModal:
    - ✅ Botones con estados de carga (spinner)
    - ✅ Deshabilitado durante impresión
    - ✅ Feedback visual con toasts de éxito/error
  - ✅ API client de printing creado (`printing.ts`)
  - ✅ Integración con endpoints:
    - ✅ `POST /api/v1/printing/comanda`
    - ✅ `POST /api/v1/printing/ticket`

**Archivos creados:**
- ✅ `packages/pos-frontend/src/features/orders/OrderDetailModal.tsx` (448 líneas)
- ✅ `packages/pos-frontend/src/lib/hooks/usePrintJobs.ts` (hook de impresión)
- ✅ `packages/pos-frontend/src/lib/api/printing.ts` (API client de impresión)

**Archivos modificados:**
- ✅ `packages/pos-frontend/src/store/cartStore.ts` (modo incremental)
- ✅ `packages/pos-frontend/src/features/pos/POSScreen.tsx` (banner y detección)
- ✅ `packages/pos-frontend/src/features/payment/PaymentModal.tsx` (soporte dual-mode)

---

## 📋 Tareas Pendientes por Fase

### FASE 4: Gestión de Deliveries - PENDIENTE (0%)

#### DeliveryPage - Lista de Deliveries
- ❌ Vista de deliveries activos
- ❌ Filtros por estado (PENDIENTE, LISTO, EN_CAMINO, ENTREGADO)
- ❌ Auto-refresh cada 5 segundos
- ❌ Grid de tarjetas de delivery

#### DeliveryCard - Tarjeta de Delivery
- ❌ Número de orden
- ❌ Nombre del cliente
- ❌ Dirección y referencia
- ❌ Teléfono
- ❌ Estado actual con badge de color
- ❌ Repartidor asignado
- ❌ Tiempo estimado
- ❌ Hora de despacho/entrega

#### DeliveryForm - Datos de Entrega
- ❌ Formulario para capturar datos de delivery (al pagar orden tipo DELIVERY)
- ❌ Campos:
  - Nombre cliente
  - Teléfono
  - Dirección
  - Referencia
  - Tiempo estimado (minutos)
- ❌ Validación de campos requeridos
- ❌ Integración con backend al crear orden DELIVERY

#### Gestión de Estados
- ❌ Botones para cambiar estado: PENDIENTE → LISTO → EN_CAMINO → ENTREGADO
- ❌ Input para asignar repartidor
- ❌ Input para actualizar tiempo estimado
- ❌ Marcar como entregado con hora automática
- ❌ Confirmaciones y validaciones

**Archivos a crear:**
- `packages/pos-frontend/src/features/deliveries/DeliveriesPage.tsx`
- `packages/pos-frontend/src/components/deliveries/DeliveryCard.tsx`
- `packages/pos-frontend/src/components/deliveries/DeliveryForm.tsx`
- `packages/pos-frontend/src/lib/hooks/useDeliveries.ts`
- `packages/pos-frontend/src/lib/api/deliveries.ts`

---

### FASE 5: Gestión de Caja - PENDIENTE (0%)

#### CajaPage - Resumen del Turno
- ❌ Mostrar información del turno activo:
  - Colaborador que abrió
  - Hora de apertura
  - Efectivo inicial
- ❌ Totales en tiempo real:
  - Total efectivo
  - Total tarjeta
  - Total transferencia
  - Total ventas
  - Cantidad de órdenes
  - Efectivo esperado (inicial + efectivo de ventas)
- ❌ Botón destacado "Cerrar Caja"
- ❌ Auto-refresh de totales

#### CerrarCajaModal - Cierre de Turno
- ❌ Modal de confirmación de cierre
- ❌ Resumen automático de ventas:
  - Desglose por método de pago
  - Cantidad de órdenes
  - Efectivo esperado calculado
- ❌ Input de efectivo real en caja (numérico)
- ❌ Cálculo automático de diferencia (real - esperado)
  - Verde si diferencia = 0
  - Amarillo/Rojo si hay diferencia
- ❌ Campo de notas (textarea)
- ❌ Checkbox "Enviar facturas pendientes al SRI"
- ❌ Botones "Cancelar" y "Confirmar Cierre"

#### Integración con Backend
- ❌ Llamada a `POST /api/v1/turnos/:id/cerrar`
- ❌ Procesar facturas pendientes si checkbox marcado
- ❌ Generar PDF de cierre automáticamente
- ❌ Descargar PDF automáticamente en navegador
- ❌ Limpiar estado de sesión (turnoStore, cartStore)
- ❌ Redirigir a LoginScreen después de cierre exitoso
- ❌ Manejo de errores con reintentos

**Archivos a crear:**
- `packages/pos-frontend/src/features/caja/CajaPage.tsx`
- `packages/pos-frontend/src/features/caja/CerrarCajaModal.tsx`
- `packages/pos-frontend/src/features/caja/ResumenCaja.tsx`
- `packages/pos-frontend/src/lib/hooks/useTurnoCierre.ts`

---

### FASE 6: Reportes Básicos - PENDIENTE (0%)

#### ReportesPage - Dashboard de Reportes
- ❌ Selector de fecha (DatePicker)
- ❌ Selector de local (si admin multi-local)
- ❌ Tarjetas de métricas principales:
  - Total de ventas
  - Cantidad de órdenes
  - Ticket promedio
  - Comparación con día anterior

#### Reporte de Ventas del Día
- ❌ Total de ventas destacado
- ❌ Cantidad de órdenes
- ❌ Ticket promedio
- ❌ Desglose por método de pago (gráfico de dona)
- ❌ Desglose por tipo de orden (gráfico de barras)

#### Productos Más Vendidos
- ❌ Tabla de productos con:
  - Nombre del producto
  - Cantidad vendida
  - Total de ventas por producto
  - Porcentaje del total
- ❌ Top 10 productos
- ❌ Ordenamiento por cantidad o por ventas

#### Gráfico de Ventas por Hora
- ❌ Gráfico de barras o líneas
- ❌ Eje X: horas del día (9:00 - 22:00)
- ❌ Eje Y: ventas en $
- ❌ Tooltip con detalles
- ❌ Identificar horas pico

**Archivos a crear:**
- `packages/pos-frontend/src/features/reportes/ReportesPage.tsx`
- `packages/pos-frontend/src/components/reportes/VentasDiaChart.tsx`
- `packages/pos-frontend/src/components/reportes/ProductosTopTable.tsx`
- `packages/pos-frontend/src/components/reportes/VentasPorHoraChart.tsx`
- `packages/pos-frontend/src/lib/hooks/useReportes.ts`
- `packages/pos-frontend/src/lib/api/reportes.ts`

---

### FASE 7: Funcionalidades Avanzadas - PENDIENTE (0%)

#### Pedidos Incrementales (refinamiento)
- ❌ Botón "Añadir Productos" en OrderDetailModal para órdenes PAID+
- ❌ Reutilizar flujo completo de POSScreen/Carrito
- ❌ Mantener contexto de orden original
- ❌ Cobro adicional con nuevo PaymentModal
- ❌ Etiquetas incrementales automáticas (-A, -B, -C, etc.)
- ❌ Mostrar en comandas y tickets

#### Switch de Colaborador
- ❌ Botón en Header "Cambiar Colaborador"
- ❌ Modal de selección de colaborador:
  - Lista de colaboradores del local
  - Indicador del colaborador actual
  - Input de PIN para validar
- ❌ Validación de PIN en backend
- ❌ Actualizar sessionStore sin cerrar turno
- ❌ No afectar el turno activo
- ❌ Log de cambios en orden (para auditoría)

#### Búsqueda de Productos
- ❌ Input de búsqueda en POSScreen (header del grid)
- ❌ Búsqueda por nombre de producto
- ❌ Búsqueda por SKU
- ❌ Filtrado en tiempo real (debounce 300ms)
- ❌ Highlight de resultados
- ❌ Limpiar búsqueda con botón X

#### Teclado Numérico Virtual
- ❌ Componente `NumericKeyboard.tsx`
- ❌ Diseño para tablets (botones grandes)
- ❌ Uso en:
  - Campo de mesa
  - Campo de cantidad de productos
  - Campo de efectivo en PaymentModal
  - Campo de efectivo real en CerrarCajaModal
- ❌ Teclas: 0-9, punto decimal, borrar, confirmar

**Archivos a crear:**
- `packages/pos-frontend/src/components/colaboradores/SwitchColaboradorModal.tsx`
- `packages/pos-frontend/src/components/ui/NumericKeyboard.tsx`
- `packages/pos-frontend/src/components/productos/ProductSearch.tsx`

---

### FASE 8: Optimizaciones y UX - PENDIENTE (0%)

#### Diseño Visual Premium
- ❌ Definir paleta de colores vibrante consistente
- ❌ Añadir gradientes en botones principales
- ❌ Sombras y profundidad en cards
- ❌ Micro-animaciones en interacciones (framer-motion)
- ❌ Hover effects suaves en todos los clickables
- ❌ Transiciones suaves entre vistas

#### Responsive Design
- ❌ Optimización específica para tablets 10-13"
- ❌ Soporte táctil completo:
  - Touch events en lugar de hover
  - Botones mínimo 44x44px
  - Espaciado adecuado
- ❌ Gestures: swipe, pinch-to-zoom (si aplica)
- ❌ Orientación landscape optimizada

#### Performance
- ❌ Lazy loading de componentes pesados (React.lazy)
- ❌ Optimización de re-renders con React.memo
- ❌ Virtual scrolling para listas largas (react-window)
- ❌ Caché agresivo de queries (React Query)
- ❌ Debounce en búsquedas y filtros
- ❌ Code splitting por rutas

#### Manejo de Errores
- ❌ Toast notifications consistentes (sonner)
- ❌ Mensajes de error claros y accionables
- ❌ Retry automático en fallos de red
- ❌ Fallbacks para estados de carga
- ❌ Error boundaries en componentes críticos
- ❌ Offline indicator

---

### FASE 9: Testing y Documentación - PENDIENTE (0%)

#### Testing Backend
- ❌ Tests unitarios de servicios clave:
  - OrderCalculatorService
  - OrderValidatorService
  - CierreCajaService
- ❌ Tests e2e de flujos principales:
  - Crear orden completa
  - Procesar pago
  - Pedido incremental
  - Cierre de turno
- ❌ Validación de cálculos:
  - Recargos
  - Totales con modificadores
  - Diferencias de caja

#### Testing Frontend
- ❌ Tests de componentes críticos:
  - ModificadoresModal
  - PaymentModal
  - OrderCard
- ❌ Tests de integración:
  - Flujo completo de crear orden
  - Flujo de pago con facturación
- ❌ Tests de hooks personalizados
- ❌ Tests de stores de Zustand

#### Documentación
- ❌ Guía de instalación (README.md)
- ❌ Guía de configuración:
  - Variables de entorno
  - Configuración de impresoras
  - Configuración de locales
- ❌ Manual de usuario para operadores:
  - Cómo abrir turno
  - Cómo tomar orden
  - Cómo procesar pago
  - Cómo gestionar deliveries
  - Cómo cerrar turno
- ❌ Documentación de API (Swagger) - mejorar
- ❌ Diagramas de flujo de procesos

---

## 🎯 Próximos Pasos Inmediatos

### 1. Completar FASE 3 (Dashboard de Órdenes) - 30% pendiente

**Prioridad Alta:**
1. ✅ **OrderDetailModal** - Vista completa de orden
   - Componente modal responsive
   - Información completa de la orden
   - Lista de items con modificadores

2. ✅ **Cambio de estados** - Botones de acción
   - Flujo de estados según tipo de orden
   - Confirmaciones
   - Integración con useUpdateOrderStatus

**Prioridad Media:**
3. ⏳ **Pedidos incrementales** - Añadir productos después del pago
   - Botón en OrderDetailModal
   - Reutilizar flujo de carrito
   - Endpoint de añadir items

4. ⏳ **Botones de impresión** - Reimprimir documentos
   - Reimprimir comanda
   - Reimprimir ticket

### 2. Iniciar FASE 4 (Deliveries)
- Implementar gestión básica de deliveries
- Estados y tracking

### 3. Iniciar FASE 5 (Gestión de Caja)
- Página de resumen de caja
- Modal de cierre con facturas

---

## 📊 Resumen de Progreso General

| Componente | Estado | Progreso |
|------------|--------|----------|
| **Backend** | ✅ Completo | 100% |
| **Frontend - FASE 1** | ✅ Completa | 100% |
| **Frontend - FASE 2** | ✅ Completa | 100% |
| **Frontend - FASE 3** | 🔄 En progreso | 85% |
| **Frontend - FASE 4** | ⏳ Pendiente | 0% |
| **Frontend - FASE 5** | ⏳ Pendiente | 0% |
| **Frontend - FASE 6** | ⏳ Pendiente | 0% |
| **Frontend - FASE 7** | ⏳ Pendiente | 0% |
| **Frontend - FASE 8** | ⏳ Pendiente | 0% |
| **Frontend - FASE 9** | ⏳ Pendiente | 0% |

**Progreso Total Frontend:** ~35% completado

**Última actualización:** Noviembre 28, 2025
- ✅ OrderDetailModal implementado con cambio de estados
- ✅ Auto-refresh optimizado (eliminado para reducir carga)
- ⏳ Pendiente: Pedidos incrementales y botones de impresión

---

## 📝 Notas Importantes

- El backend está 100% funcional y listo para usar
- El frontend tiene la estructura base sólida (React Query, Zustand, Routing)
- Priorizar completar FASE 3 antes de avanzar a siguientes fases
- Mantener UX/UI premium con diseño moderno y atractivo
- Optimizar para tablets con soporte táctil
- Mantener performance con tiempo de pedido < 8 segundos
- Todos los hooks de API están creados y funcionando
- La integración con facturacion-core está completa y probada
