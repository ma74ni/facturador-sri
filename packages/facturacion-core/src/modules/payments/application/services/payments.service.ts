import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, InvoicePaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePaymentDto, companyId: string, createdById: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, companyId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const allocatedTotal = dto.allocations.reduce((sum, a) => sum + a.amount, 0);
    if (allocatedTotal > dto.totalAmount + 0.01) {
      throw new BadRequestException(
        'La suma de los montos aplicados a facturas no puede superar el monto total del pago',
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          companyId,
          customerId: dto.customerId,
          paymentDate: new Date(dto.paymentDate),
          totalAmount: dto.totalAmount,
          reference: dto.reference,
          note: dto.note,
          createdById,
        },
      });

      for (const allocation of dto.allocations) {
        const invoice = await tx.invoice.findFirst({
          where: { id: allocation.invoiceId, companyId, customerId: dto.customerId },
          include: { allocations: true },
        });
        if (!invoice) {
          throw new NotFoundException(
            `Factura ${allocation.invoiceId} no encontrada para este cliente`,
          );
        }

        const alreadySettled = invoice.allocations.reduce(
          (sum, a) => sum + Number(a.amount) + Number(a.retentionAmount),
          0,
        );
        const remaining = Number(invoice.total) - alreadySettled;
        const retentionAmount = allocation.retentionAmount ?? 0;
        if (allocation.amount + retentionAmount > remaining + 0.01) {
          throw new BadRequestException(
            `El monto aplicado a la factura ${invoice.sequential} (${allocation.amount} + ${retentionAmount} de retención) excede su saldo pendiente (${remaining.toFixed(2)})`,
          );
        }

        await tx.paymentAllocation.create({
          data: {
            paymentId: created.id,
            invoiceId: allocation.invoiceId,
            amount: allocation.amount,
            retentionAmount,
          },
        });

        await this.syncInvoicePaymentStatus(tx, allocation.invoiceId);
      }

      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
        include: { allocations: { include: { invoice: true } } },
      });
    });

    return {
      message: 'Pago registrado exitosamente',
      payment: this.serializePayment(payment),
    };
  }

  async remove(id: string, companyId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, companyId },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    const invoiceIds = payment.allocations.map((a) => a.invoiceId);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id } }); // cascade borra las allocations
      for (const invoiceId of invoiceIds) {
        await this.syncInvoicePaymentStatus(tx, invoiceId);
      }
    });

    return { message: 'Pago eliminado exitosamente' };
  }

  async getAccountStatement(customerId: string, companyId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { customerId, companyId },
      include: { allocations: true },
      orderBy: { issueDate: 'asc' },
    });

    const invoiceStatements = invoices.map((invoice) => {
      const paidAmount = invoice.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
      const retainedAmount = invoice.allocations.reduce(
        (sum, a) => sum + Number(a.retentionAmount),
        0,
      );
      return {
        id: invoice.id,
        sequential: invoice.sequential,
        establishmentCode: invoice.establishmentCode,
        emissionPointCode: invoice.emissionPointCode,
        issueDate: invoice.issueDate,
        total: Number(invoice.total),
        paidAmount,
        retainedAmount,
        balance: Number(invoice.total) - paidAmount - retainedAmount,
        paymentStatus: invoice.paymentStatus,
        sriStatus: invoice.sriStatus,
      };
    });

    const paymentsRaw = await this.prisma.payment.findMany({
      where: { customerId, companyId },
      include: { allocations: { include: { invoice: true } } },
      orderBy: { paymentDate: 'desc' },
    });
    const payments = paymentsRaw.map((payment) => this.serializePayment(payment));

    const totalPending = invoiceStatements.reduce((sum, i) => sum + i.balance, 0);

    return {
      customer,
      invoices: invoiceStatements,
      payments,
      totalPending,
    };
  }

  // Prisma serializa Decimal como string por default en JSON; el frontend
  // espera number (usa .toFixed en la UI de cobranza).
  private serializePayment(payment: any) {
    return {
      ...payment,
      totalAmount: Number(payment.totalAmount),
      allocations: payment.allocations.map((allocation: any) => ({
        ...allocation,
        amount: Number(allocation.amount),
        retentionAmount: Number(allocation.retentionAmount),
      })),
    };
  }

  private async syncInvoicePaymentStatus(tx: Tx, invoiceId: string) {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { allocations: true },
    });

    const settledAmount = invoice.allocations.reduce(
      (sum, a) => sum + Number(a.amount) + Number(a.retentionAmount),
      0,
    );
    const total = Number(invoice.total);

    let paymentStatus: InvoicePaymentStatus = InvoicePaymentStatus.PENDING;
    if (settledAmount >= total - 0.01) {
      paymentStatus = InvoicePaymentStatus.PAID;
    } else if (settledAmount > 0) {
      paymentStatus = InvoicePaymentStatus.PARTIALLY_PAID;
    }

    await tx.invoice.update({ where: { id: invoiceId }, data: { paymentStatus } });
  }
}
