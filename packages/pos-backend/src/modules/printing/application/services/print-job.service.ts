import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ComandaGeneratorService } from './comanda-generator.service';
import { TicketGeneratorService } from './ticket-generator.service';
import { CierreCajaGeneratorService } from './cierre-caja-generator.service';
import { PrintJob } from '@prisma/client';

@Injectable()
export class PrintJobService {
  private readonly logger = new Logger(PrintJobService.name);
  private readonly MAX_REINTENTOS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly comandaGenerator: ComandaGeneratorService,
    private readonly ticketGenerator: TicketGeneratorService,
    private readonly cierreCajaGenerator: CierreCajaGeneratorService,
  ) {}

  /**
   * Procesar cola de impresión cada 10 segundos
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processQueue(): Promise<void> {
    const pendingJobs = await this.prisma.printJob.findMany({
      where: {
        estado: 'PENDIENTE',
        intentos: {
          lt: this.MAX_REINTENTOS,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10, // Procesar 10 trabajos por ciclo
    });

    if (pendingJobs.length === 0) {
      return;
    }

    this.logger.log(`Procesando ${pendingJobs.length} trabajos de impresión...`);

    for (const job of pendingJobs) {
      await this.processJob(job);
    }
  }

  /**
   * Procesar un trabajo de impresión individual
   */
  private async processJob(job: PrintJob): Promise<void> {
    try {
      this.logger.log(`Procesando print job ${job.id} - Tipo: ${job.tipo}`);

      // Marcar como en proceso
      await this.prisma.printJob.update({
        where: { id: job.id },
        data: {
          estado: 'PROCESANDO',
          intentos: job.intentos + 1,
        },
      });

      let success = false;

      // Ejecutar impresión según tipo
      switch (job.tipo) {
        case 'COMANDA':
          success = await this.comandaGenerator.print(job.contenido as any);
          break;

        case 'TICKET':
          success = await this.ticketGenerator.print(job.contenido as any);
          break;

        case 'CIERRE_CAJA':
          success = await this.cierreCajaGenerator.print(job.contenido as any);
          break;

        default:
          throw new Error(`Tipo de impresión no soportado: ${job.tipo}`);
      }

      if (success) {
        // Marcar como completado
        await this.prisma.printJob.update({
          where: { id: job.id },
          data: {
            estado: 'COMPLETADO',
          },
        });

        this.logger.log(`Print job ${job.id} completado exitosamente`);
      } else {
        throw new Error('Impresión falló sin excepción');
      }
    } catch (error) {
      this.logger.error(`Error procesando print job ${job.id}:`, error.message);

      // Si alcanzó el máximo de reintentos, marcar como fallido
      if (job.intentos + 1 >= this.MAX_REINTENTOS) {
        await this.prisma.printJob.update({
          where: { id: job.id },
          data: {
            estado: 'ERROR',
            mensajeError: error.message,
          },
        });

        this.logger.error(
          `Print job ${job.id} marcado como FAILED después de ${this.MAX_REINTENTOS} intentos`,
        );
      } else {
        // Volver a marcar como pendiente para reintento
        await this.prisma.printJob.update({
          where: { id: job.id },
          data: {
            estado: 'PENDIENTE',
            mensajeError: error.message,
          },
        });

        this.logger.warn(
          `Print job ${job.id} reintentará (${job.intentos + 1}/${this.MAX_REINTENTOS})`,
        );
      }
    }
  }

  /**
   * Crear trabajo de impresión de comanda
   */
  async createComandaJob(orderId: string | null, data: any): Promise<PrintJob> {
    return this.prisma.printJob.create({
      data: {
        orderId,
        tipo: 'COMANDA',
        estado: 'PENDIENTE',
        intentos: 0,
        printerName: this.configService.get('printer.name', 'Default Printer'),
        contenido: data,
      },
    });
  }

  /**
   * Crear trabajo de impresión de ticket
   */
  async createTicketJob(orderId: string | null, data: any): Promise<PrintJob> {
    return this.prisma.printJob.create({
      data: {
        orderId,
        tipo: 'TICKET',
        estado: 'PENDIENTE',
        intentos: 0,
        printerName: this.configService.get('printer.name', 'Default Printer'),
        contenido: data,
      },
    });
  }

  /**
   * Crear trabajo de impresión de cierre de caja
   */
  async createCierreCajaJob(data: any): Promise<PrintJob> {
    return this.prisma.printJob.create({
      data: {
        tipo: 'CIERRE_CAJA',
        estado: 'PENDIENTE',
        intentos: 0,
        printerName: this.configService.get('printer.name', 'Default Printer'),
        contenido: data,
      },
    });
  }

  /**
   * Reimprimir un trabajo
   */
  async reprint(jobId: string): Promise<PrintJob> {
    const job = await this.prisma.printJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error('Print job no encontrado');
    }

    // Crear nuevo trabajo con los mismos datos
    return this.prisma.printJob.create({
      data: {
        orderId: job.orderId,
        tipo: job.tipo,
        estado: 'PENDIENTE',
        intentos: 0,
        printerName: job.printerName,
        contenido: job.contenido as any,
      },
    });
  }

  /**
   * Obtener trabajos de impresión por orden
   */
  async findByOrder(orderId: string): Promise<PrintJob[]> {
    return this.prisma.printJob.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtener trabajos pendientes
   */
  async findPending(): Promise<PrintJob[]> {
    return this.prisma.printJob.findMany({
      where: {
        estado: 'PENDIENTE',
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Obtener trabajos fallidos
   */
  async findFailed(): Promise<PrintJob[]> {
    return this.prisma.printJob.findMany({
      where: {
        estado: 'ERROR',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Reintentar trabajos fallidos
   */
  async retryFailed(): Promise<number> {
    const failedJobs = await this.findFailed();

    for (const job of failedJobs) {
      await this.prisma.printJob.update({
        where: { id: job.id },
        data: {
          estado: 'PENDIENTE',
          intentos: 0,
          mensajeError: null,
        },
      });
    }

    this.logger.log(`${failedJobs.length} trabajos fallidos marcados para reintento`);
    return failedJobs.length;
  }

  /**
   * Limpiar trabajos antiguos (más de 30 días)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanOldJobs(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.prisma.printJob.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
        estado: {
          in: ['COMPLETADO', 'ERROR'],
        },
      },
    });

    this.logger.log(`${result.count} trabajos antiguos eliminados`);
  }
}
