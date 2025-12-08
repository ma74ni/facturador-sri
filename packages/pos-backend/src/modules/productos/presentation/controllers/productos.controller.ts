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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProductosService } from '../../application/services/productos.service';
import {
  CreateProductoDto,
  UpdateProductoDto,
  AssignProductoLocalDto,
} from '../../application/dto';
import { Roles } from '@shared/decorators';
import { RolesGuard } from '@shared/guards';
import { RolColaborador } from '@prisma/client-pos';

/**
 * Controller para gestión de productos del catálogo central
 *
 * ## Permisos por Rol:
 * - **VENDEDOR**: Solo lectura (GET)
 * - **SUPERVISOR**: Lectura + asignación a su local
 * - **ADMINISTRADOR**: Control total del catálogo
 *
 * ## Nota de Implementación:
 * Los guards están configurados pero requieren que se implemente primero
 * un sistema de autenticación (JWT) que establezca `request.user` con:
 * - colaboradorId
 * - localId
 * - rol (RolColaborador)
 *
 * Una vez implementado el AuthGuard, descomentar `@UseGuards(JwtAuthGuard, RolesGuard)`
 */
@ApiTags('productos')
@Controller('productos')
// TODO: Descomentar cuando se implemente JwtAuthGuard
// @UseGuards(JwtAuthGuard, RolesGuard)
// @ApiBearerAuth()
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  /**
   * Crear producto en catálogo central
   * Solo ADMINISTRADOR puede crear productos
   */
  @Post()
  // TODO: Descomentar cuando se implemente autenticación
  // @Roles(RolColaborador.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Crear un nuevo producto en el catálogo central',
    description: 'Solo ADMINISTRADOR. Crea un producto que estará disponible para todos los locales.',
  })
  @ApiResponse({ status: 201, description: 'Producto creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El SKU ya existe' })
  @ApiResponse({ status: 403, description: 'No tienes permisos (requiere rol ADMINISTRADOR)' })
  create(@Body() createProductoDto: CreateProductoDto) {
    return this.productosService.create(createProductoDto);
  }

  /**
   * Listar todos los productos
   * Todos los roles pueden ver la lista completa
   */
  @Get()
  @ApiOperation({
    summary: 'Obtener todos los productos del catálogo',
    description: 'Accesible para todos los roles.',
  })
  @ApiResponse({ status: 200, description: 'Lista de productos' })
  findAll() {
    return this.productosService.findAll();
  }

  /**
   * Listar solo productos activos
   * Todos los roles pueden ver productos activos
   */
  @Get('active')
  @ApiOperation({
    summary: 'Obtener solo productos activos',
    description: 'Accesible para todos los roles.',
  })
  @ApiResponse({ status: 200, description: 'Lista de productos activos' })
  findActive() {
    return this.productosService.findActive();
  }

  /**
   * Listar productos disponibles por local
   * Todos pueden ver, pero en producción se debería validar que
   * VENDEDOR/SUPERVISOR solo vean su local
   */
  @Get('local/:localId')
  @ApiOperation({
    summary: 'Obtener productos disponibles en un local específico',
    description: 'VENDEDOR/SUPERVISOR: solo su local. ADMINISTRADOR: cualquier local.',
  })
  @ApiResponse({
    status: 200,
    description: 'Productos disponibles en el local',
  })
  @ApiResponse({ status: 403, description: 'No puedes ver productos de otro local' })
  findByLocal(@Param('localId') localId: string) {
    // TODO: Validar que VENDEDOR/SUPERVISOR solo vean su local
    // if (user.rol !== RolColaborador.ADMINISTRADOR && localId !== user.localId) {
    //   throw new ForbiddenException('No puedes ver productos de otro local');
    // }
    return this.productosService.findByLocal(localId);
  }

  /**
   * Obtener producto por ID
   * Todos los roles pueden ver detalles
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de un producto',
    description: 'Accesible para todos los roles.',
  })
  @ApiResponse({ status: 200, description: 'Producto encontrado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  findOne(@Param('id') id: string) {
    return this.productosService.findOne(id);
  }

  /**
   * Actualizar producto del catálogo central
   * Solo ADMINISTRADOR puede editar el catálogo
   */
  @Patch(':id')
  // TODO: Descomentar cuando se implemente autenticación
  // @Roles(RolColaborador.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Actualizar un producto del catálogo central',
    description: 'Solo ADMINISTRADOR. Actualiza precios base, nombre, categoría, etc.',
  })
  @ApiResponse({ status: 200, description: 'Producto actualizado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos (requiere rol ADMINISTRADOR)' })
  update(
    @Param('id') id: string,
    @Body() updateProductoDto: UpdateProductoDto,
  ) {
    return this.productosService.update(id, updateProductoDto);
  }

  /**
   * Eliminar producto del catálogo (soft delete)
   * Solo ADMINISTRADOR puede eliminar productos
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // TODO: Descomentar cuando se implemente autenticación
  // @Roles(RolColaborador.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Eliminar un producto del catálogo (soft delete)',
    description: 'Solo ADMINISTRADOR. Desactiva el producto en todos los locales.',
  })
  @ApiResponse({ status: 204, description: 'Producto eliminado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos (requiere rol ADMINISTRADOR)' })
  remove(@Param('id') id: string) {
    return this.productosService.remove(id);
  }

  /**
   * Asignar/configurar producto para un local específico
   * SUPERVISOR puede asignar a su local, ADMINISTRADOR a cualquier local
   */
  @Post('assign-local')
  // TODO: Descomentar cuando se implemente autenticación
  // @Roles(RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Asignar/configurar producto para un local',
    description:
      'SUPERVISOR: solo puede asignar a su local. ADMINISTRADOR: puede asignar a cualquier local. ' +
      'Permite configurar disponibilidad, stock y precios locales diferenciados.',
  })
  @ApiResponse({ status: 201, description: 'Producto asignado al local' })
  @ApiResponse({ status: 403, description: 'No puedes asignar productos a otro local' })
  assignToLocal(@Body() assignDto: AssignProductoLocalDto) {
    // TODO: Validar que SUPERVISOR solo asigne a su local
    // if (user.rol === RolColaborador.SUPERVISOR && assignDto.localId !== user.localId) {
    //   throw new ForbiddenException('No puedes asignar productos a otro local');
    // }
    return this.productosService.assignToLocal(assignDto);
  }
}
