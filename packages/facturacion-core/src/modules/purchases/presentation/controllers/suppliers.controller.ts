import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from '../../../auth/infrastructure/guards/require-module.guard';
import { RequireModule } from '../../../auth/infrastructure/decorators/require-module.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';
import { COMPRAS_MODULE } from '../../../companies/domain/product-modules.catalog';
import { SuppliersService } from '../../application/services/suppliers.service';
import { CreateSupplierDto } from '../../application/dto/create-supplier.dto';
import { UpdateSupplierDto } from '../../application/dto/update-supplier.dto';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RequireModuleGuard)
@RequireModule(COMPRAS_MODULE)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar y buscar los proveedores de la empresa' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Razón social, nombre o identificación',
  })
  async findAll(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: unknown) {
    return this.suppliers.findAll(user.companyId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un proveedor' })
  @ApiResponse({ status: 404, description: 'No existe o es de otra empresa' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliers.findOne(id, user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un proveedor' })
  @ApiResponse({ status: 201, description: 'Proveedor creado' })
  @ApiResponse({ status: 400, description: 'Identificación no válida para su tipo' })
  @ApiResponse({ status: 409, description: 'Ya hay un proveedor con esa identificación' })
  async create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliers.create(dto, user.companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un proveedor' })
  @ApiResponse({ status: 404, description: 'No existe o es de otra empresa' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliers.update(id, dto, user.companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un proveedor' })
  @ApiResponse({ status: 404, description: 'No existe o es de otra empresa' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliers.remove(id, user.companyId);
  }
}
