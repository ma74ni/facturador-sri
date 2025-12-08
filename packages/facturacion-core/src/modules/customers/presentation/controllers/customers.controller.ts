import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from '../../application/services/customers.service';
import { CreateCustomerDto } from '../../application/dto/create-customer.dto';
import { UpdateCustomerDto } from '../../application/dto/update-customer.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { PrismaService } from '../../../../shared/database/prisma.service';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly prisma: PrismaService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user.companyId;
  }

  @Post()
  @ApiOperation({ summary: 'Crear nuevo cliente' })
  async create(@Body() dto: CreateCustomerDto, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.customersService.create(dto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los clientes' })
  async findAll(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.customersService.findAll(companyId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar clientes' })
  async search(@Query('q') query: string, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.customersService.search(query, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cliente por ID' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.customersService.findOne(id, companyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar cliente' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @Request() req: any,
  ) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.customersService.update(id, dto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cliente' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.customersService.remove(id, companyId);
  }
}