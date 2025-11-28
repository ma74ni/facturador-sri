-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoModificador" AS ENUM ('SABOR', 'TOPPING', 'ADEREZO', 'SUSTITUCION');

-- CreateEnum
CREATE TYPE "TipoOrden" AS ENUM ('AQUI', 'LLEVAR', 'DELIVERY');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('NEW', 'PAID', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MIXTO');

-- CreateEnum
CREATE TYPE "EstadoDelivery" AS ENUM ('PENDIENTE', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoInvoiceQueue" AS ENUM ('PENDIENTE', 'ENVIANDO', 'ENVIADA', 'AUTORIZADA', 'ERROR', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "TipoPrint" AS ENUM ('COMANDA', 'TICKET', 'CIERRE_CAJA');

-- CreateEnum
CREATE TYPE "EstadoPrint" AS ENUM ('PENDIENTE', 'IMPRIMIENDO', 'IMPRESO', 'ERROR');

-- CreateTable
CREATE TABLE "locales" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "establishmentCode" TEXT NOT NULL,
    "emissionPointCode" TEXT NOT NULL,
    "printerComanda" TEXT,
    "printerTicket" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "pin" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "localId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" TEXT NOT NULL,
    "numeroSecuencial" INTEGER NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "horaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "efectivoInicial" DECIMAL(10,2) NOT NULL,
    "horaCierre" TIMESTAMP(3),
    "efectivoEsperado" DECIMAL(10,2),
    "efectivoReal" DECIMAL(10,2),
    "diferencia" DECIMAL(10,2),
    "notasCierre" TEXT,
    "totalEfectivo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTarjeta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTransferencia" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalVentas" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cantidadOrdenes" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'ABIERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "icono" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "permiteSeleccionarSabores" BOOLEAN NOT NULL DEFAULT false,
    "cantidadSaboresObligatorios" INTEGER,
    "cantidadSaboresMax" INTEGER,
    "permiteSeleccionarToppings" BOOLEAN NOT NULL DEFAULT false,
    "cantidadToppingsMax" INTEGER,
    "permiteSeleccionarAderezos" BOOLEAN NOT NULL DEFAULT false,
    "cantidadAderezosMax" INTEGER,
    "permiteSustituciones" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "sku" TEXT NOT NULL,
    "precioBase" DECIMAL(10,2) NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "facturacionProductId" TEXT,
    "codigoIVA" TEXT NOT NULL DEFAULT '2',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_locales" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "stockMinimo" INTEGER,
    "precioLocal" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modificadores" (
    "id" TEXT NOT NULL,
    "tipo" "TipoModificador" NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioAdicional" DECIMAL(10,2),
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modificadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "numeroSecuencial" INTEGER NOT NULL,
    "numeroMesa" TEXT,
    "localId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" "TipoOrden" NOT NULL DEFAULT 'AQUI',
    "estado" "EstadoOrden" NOT NULL DEFAULT 'NEW',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "recargoPorcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "recargoMonto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "metodoPago" "MetodoPago",
    "montoPagado" DECIMAL(10,2),
    "montoCambio" DECIMAL(10,2),
    "fechaPago" TIMESTAMP(3),
    "requiereFactura" BOOLEAN NOT NULL DEFAULT false,
    "invoiceQueued" BOOLEAN NOT NULL DEFAULT false,
    "facturacionCustomerId" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "sabores" JSONB,
    "toppings" JSONB,
    "aderezos" JSONB,
    "sustituciones" JSONB,
    "subtotalItem" DECIMAL(10,2) NOT NULL,
    "etiquetaIncremental" TEXT,
    "esIncremental" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "referencia" TEXT,
    "telefono" TEXT NOT NULL,
    "nombreCliente" TEXT NOT NULL,
    "estado" "EstadoDelivery" NOT NULL DEFAULT 'PENDIENTE',
    "repartidor" TEXT,
    "tiempoEstimado" INTEGER,
    "horaDespacho" TIMESTAMP(3),
    "horaEntrega" TIMESTAMP(3),
    "metodoEnvio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_queue" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "facturacionCustomerId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "estado" "EstadoInvoiceQueue" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIntento" TIMESTAMP(3),
    "mensajeError" TEXT,
    "claveAcceso" TEXT,
    "numeroAutorizacion" TEXT,
    "fechaAutorizacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" TEXT NOT NULL,
    "tipo" "TipoPrint" NOT NULL,
    "orderId" TEXT,
    "turnoId" TEXT,
    "printerName" TEXT NOT NULL,
    "contenido" JSONB NOT NULL,
    "estado" "EstadoPrint" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIntento" TIMESTAMP(3),
    "mensajeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locales_codigo_key" ON "locales"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_localId_numeroSecuencial_key" ON "turnos"("localId", "numeroSecuencial");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_codigo_key" ON "categorias"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_sku_key" ON "productos"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "productos_locales_productoId_localId_key" ON "productos_locales"("productoId", "localId");

-- CreateIndex
CREATE INDEX "orders_turnoId_idx" ON "orders"("turnoId");

-- CreateIndex
CREATE INDEX "orders_estado_idx" ON "orders"("estado");

-- CreateIndex
CREATE INDEX "orders_tipo_idx" ON "orders"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "orders_localId_numeroSecuencial_key" ON "orders"("localId", "numeroSecuencial");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_orderId_key" ON "deliveries"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_queue_orderId_key" ON "invoice_queue"("orderId");

-- CreateIndex
CREATE INDEX "invoice_queue_estado_idx" ON "invoice_queue"("estado");

-- CreateIndex
CREATE INDEX "print_jobs_estado_idx" ON "print_jobs"("estado");

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_locales" ADD CONSTRAINT "productos_locales_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_locales" ADD CONSTRAINT "productos_locales_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
