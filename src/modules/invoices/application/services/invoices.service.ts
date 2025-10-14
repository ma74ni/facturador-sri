import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { AccessKeyService } from '../../domain/services/access-key.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private accessKeyService: AccessKeyService,
  ) {}

  async create(dto: CreateInvoiceDto, companyId: string, userId: string) {
    // 1. Validar cliente
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, companyId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // 2. Validar establecimiento y punto de emisión
    const establishment = await this.prisma.establishment.findFirst({
      where: { id: dto.establishmentId, companyId },
    });
    if (!establishment) {
      throw new NotFoundException('Establecimiento no encontrado');
    }

    const emissionPoint = await this.prisma.emissionPoint.findFirst({
      where: { id: dto.emissionPointId, establishmentId: establishment.id },
    });
    if (!emissionPoint) {
      throw new NotFoundException('Punto de emisión no encontrado');
    }

    // 3. Obtener compañía (para RUC y ambiente)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Compañía no encontrada');
    }

    // 4. Obtener secuencial y actualizar
    const sequential = emissionPoint.invoiceSequence.toString().padStart(9, '0');
    await this.prisma.emissionPoint.update({
      where: { id: emissionPoint.id },
      data: { invoiceSequence: emissionPoint.invoiceSequence + 1 },
    });

    // 5. Calcular totales
    let subtotal = new Decimal(0);
    let totalDiscount = new Decimal(0);
    let ivaValue = new Decimal(0);

    const calculatedItems = [];

    for (const item of dto.items) {
      const itemSubtotal = new Decimal(item.quantity).mul(item.unitPrice);
      const itemDiscount = new Decimal(item.discount || 0);
      const itemTotal = itemSubtotal.sub(itemDiscount);

      subtotal = subtotal.add(itemTotal);
      totalDiscount = totalDiscount.add(itemDiscount);

      // Por ahora, aplicamos IVA 15% a todos los productos
      const itemIva = itemTotal.mul(0.15);
      ivaValue = ivaValue.add(itemIva);

      calculatedItems.push({
        ...item,
        subtotal: itemTotal.toNumber(),
      });
    }

    const total = subtotal.add(ivaValue);

    // 6. Generar clave de acceso
    const issueDate = new Date(dto.issueDate);
    const accessKey = this.accessKeyService.generateAccessKey(
      issueDate,
      '01', // 01 = Factura
      company.ruc,
      company.environment,
      establishment.code,
      emissionPoint.code,
      sequential,
    );

    // 7. Crear factura con items
    const invoice = await this.prisma.invoice.create({
      data: {
        documentType: '01',
        accessKey,
        establishmentCode: establishment.code,
        emissionPointCode: emissionPoint.code,
        sequential,
        issueDate,
        customerId: customer.id,
        establishmentId: establishment.id,
        emissionPointId: emissionPoint.id,
        subtotal: subtotal.toNumber(),
        totalDiscount: totalDiscount.toNumber(),
        ivaValue: ivaValue.toNumber(),
        total: total.toNumber(),
        companyId,
        createdById: userId,
        sriStatus: 'PENDING',
        items: {
          create: calculatedItems.map((item) => ({
            productId: item.productId,
            mainCode: item.mainCode,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            subtotal: item.subtotal,
          })),
        },
      },
      include: {
        items: true,
        customer: true,
        establishment: true,
        emissionPoint: true,
      },
    });

    return {
      message: 'Factura creada exitosamente',
      invoice: {
        ...invoice,
        formattedNumber: `${establishment.code}-${emissionPoint.code}-${sequential}`,
      },
    };
  }

  async findAll(companyId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId },
      include: {
        customer: {
          select: {
            identification: true,
            firstName: true,
            lastName: true,
            businessName: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Facturas obtenidas exitosamente',
      count: invoices.length,
      invoices: invoices.map((inv) => ({
        ...inv,
        formattedNumber: `${inv.establishmentCode}-${inv.emissionPointCode}-${inv.sequential}`,
      })),
    };
  }

  async findOne(id: string, companyId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        items: true,
        customer: true,
        establishment: true,
        emissionPoint: true,
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return {
      message: 'Factura encontrada',
      invoice: {
        ...invoice,
        formattedNumber: `${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential}`,
      },
    };
  }

  async findByAccessKey(accessKey: string, companyId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { accessKey, companyId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return {
      message: 'Factura encontrada',
      invoice,
    };
  }

  async getStats(companyId: string) {
    const [total, pending, authorized, rejected] = await Promise.all([
      this.prisma.invoice.count({ where: { companyId } }),
      this.prisma.invoice.count({ where: { companyId, sriStatus: 'PENDING' } }),
      this.prisma.invoice.count({ where: { companyId, sriStatus: 'AUTHORIZED' } }),
      this.prisma.invoice.count({ where: { companyId, sriStatus: 'REJECTED' } }),
    ]);

    const totalAmount = await this.prisma.invoice.aggregate({
      where: { companyId },
      _sum: { total: true },
    });

    return {
      message: 'Estadísticas obtenidas',
      stats: {
        total,
        pending,
        authorized,
        rejected,
        totalAmount: totalAmount._sum.total || 0,
      },
    };
  }
}