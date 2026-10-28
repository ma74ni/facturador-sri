import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from '../../application/services/products.service';
import { CreateProductDto } from '../../application/dto/create-product.dto';
import { UpdateProductDto } from '../../application/dto/update-product.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo producto' })
  async create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.productsService.create(dto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los productos' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.productsService.findAll(companyId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar productos' })
  async search(@Query('q') query: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.productsService.search(query, companyId);
  }

  @Get('by-code/:code')
  @ApiOperation({ summary: 'Obtener producto por código' })
  async findByCode(@Param('code') code: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.productsService.findByCode(code, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.productsService.findOne(id, companyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar producto' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;
    return this.productsService.update(id, dto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar producto' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.productsService.remove(id, companyId);
  }
}
