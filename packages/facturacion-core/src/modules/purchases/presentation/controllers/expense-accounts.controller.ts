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
import { ExpenseAccountsService } from '../../application/services/expense-accounts.service';
import { CreateExpenseAccountDto } from '../../application/dto/create-expense-account.dto';
import { UpdateExpenseAccountDto } from '../../application/dto/update-expense-account.dto';
import { ImportExpenseAccountsDto } from '../../application/dto/import-expense-accounts.dto';

@ApiTags('expense-accounts')
@Controller('expense-accounts')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RequireModuleGuard)
@RequireModule(COMPRAS_MODULE)
@ApiBearerAuth()
export class ExpenseAccountsController {
  constructor(private readonly accounts: ExpenseAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar las cuentas de gasto de la empresa' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: '"true" incluye las inactivas',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: unknown,
  ) {
    return this.accounts.findAll(user.companyId, includeInactive);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una cuenta de gasto' })
  @ApiResponse({ status: 201, description: 'Cuenta creada' })
  @ApiResponse({ status: 409, description: 'Ya hay una cuenta con ese nombre o código' })
  async create(@Body() dto: CreateExpenseAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.accounts.create(dto, user.companyId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Cargar la lista de cuentas que pasa el contador (una por línea)' })
  @ApiResponse({
    status: 201,
    description: 'Cuántas se crearon y qué líneas se omitieron, con su motivo',
  })
  @ApiResponse({ status: 400, description: 'Lista vacía o con demasiadas líneas' })
  async importList(@Body() dto: ImportExpenseAccountsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.accounts.importList(dto.text, user.companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar, activar o desactivar una cuenta de gasto' })
  @ApiResponse({ status: 404, description: 'No existe o es de otra empresa' })
  @ApiResponse({ status: 409, description: 'Ya hay una cuenta con ese nombre o código' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accounts.update(id, dto, user.companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una cuenta de gasto' })
  @ApiResponse({ status: 404, description: 'No existe o es de otra empresa' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.accounts.remove(id, user.companyId);
  }
}
