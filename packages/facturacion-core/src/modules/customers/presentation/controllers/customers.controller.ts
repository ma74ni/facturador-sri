import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from '../../application/services/customers.service';
import { CreateCustomerDto } from '../../application/dto/create-customer.dto';
import { UpdateCustomerDto } from '../../application/dto/update-customer.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo cliente' })
  async create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.customersService.create(dto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los clientes' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.customersService.findAll(companyId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar clientes' })
  async search(@Query('q') query: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.customersService.search(query, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cliente por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.customersService.findOne(id, companyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar cliente' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;
    return this.customersService.update(id, dto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cliente' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.customersService.remove(id, companyId);
  }
}
