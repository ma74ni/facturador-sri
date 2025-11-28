import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProductosService } from '../../application/services/productos.service';
import {
  CreateProductoDto,
  UpdateProductoDto,
  AssignProductoLocalDto,
} from '../../application/dto';

@ApiTags('productos')
@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo producto' })
  @ApiResponse({ status: 201, description: 'Producto creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El SKU ya existe' })
  create(@Body() createProductoDto: CreateProductoDto) {
    return this.productosService.create(createProductoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los productos' })
  @ApiResponse({ status: 200, description: 'Lista de productos' })
  findAll() {
    return this.productosService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener solo productos activos' })
  @ApiResponse({ status: 200, description: 'Lista de productos activos' })
  findActive() {
    return this.productosService.findActive();
  }

  @Get('local/:localId')
  @ApiOperation({ summary: 'Obtener productos disponibles por local' })
  @ApiResponse({
    status: 200,
    description: 'Productos disponibles en el local',
  })
  findByLocal(@Param('localId') localId: string) {
    return this.productosService.findByLocal(localId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un producto por ID' })
  @ApiResponse({ status: 200, description: 'Producto encontrado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  findOne(@Param('id') id: string) {
    return this.productosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un producto' })
  @ApiResponse({ status: 200, description: 'Producto actualizado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  update(
    @Param('id') id: string,
    @Body() updateProductoDto: UpdateProductoDto,
  ) {
    return this.productosService.update(id, updateProductoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un producto (soft delete)' })
  @ApiResponse({ status: 204, description: 'Producto eliminado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  remove(@Param('id') id: string) {
    return this.productosService.remove(id);
  }

  @Post('assign-local')
  @ApiOperation({ summary: 'Asignar producto a un local' })
  @ApiResponse({ status: 201, description: 'Producto asignado al local' })
  assignToLocal(@Body() assignDto: AssignProductoLocalDto) {
    return this.productosService.assignToLocal(assignDto);
  }
}
