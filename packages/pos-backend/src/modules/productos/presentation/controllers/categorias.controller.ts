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
import { CategoriasService } from '../../application/services/categorias.service';
import { CreateCategoriaDto, UpdateCategoriaDto } from '../../application/dto';
import { Roles } from '@shared/decorators';
import { RolesGuard } from '@shared/guards';
import { RolColaborador } from '@prisma/client-pos';

/**
 * Controller para gestión de categorías de productos
 *
 * ## Permisos por Rol:
 * - **VENDEDOR**: Solo lectura (GET)
 * - **SUPERVISOR**: Solo lectura (GET)
 * - **ADMINISTRADOR**: Control total (CRUD)
 *
 * Las categorías son parte del catálogo central y solo el ADMINISTRADOR
 * puede crear, editar o eliminar categorías.
 */
@ApiTags('categorias')
@Controller('categorias')
// TODO: Descomentar cuando se implemente JwtAuthGuard
// @UseGuards(JwtAuthGuard, RolesGuard)
// @ApiBearerAuth()
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  /**
   * Crear nueva categoría
   * Solo ADMINISTRADOR puede crear categorías
   */
  @Post()
  // TODO: Descomentar cuando se implemente autenticación
  // @Roles(RolColaborador.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Crear una nueva categoría',
    description: 'Solo ADMINISTRADOR. Las categorías organizan el catálogo de productos.',
  })
  @ApiResponse({ status: 201, description: 'Categoría creada exitosamente' })
  @ApiResponse({ status: 409, description: 'El código ya existe' })
  @ApiResponse({ status: 403, description: 'No tienes permisos (requiere rol ADMINISTRADOR)' })
  create(@Body() createCategoriaDto: CreateCategoriaDto) {
    return this.categoriasService.create(createCategoriaDto);
  }

  /**
   * Listar todas las categorías
   * Todos los roles pueden ver la lista
   */
  @Get()
  @ApiOperation({
    summary: 'Obtener todas las categorías',
    description: 'Accesible para todos los roles.',
  })
  @ApiResponse({ status: 200, description: 'Lista de categorías' })
  findAll() {
    return this.categoriasService.findAll();
  }

  /**
   * Listar solo categorías activas
   * Todos los roles pueden ver categorías activas
   */
  @Get('active')
  @ApiOperation({
    summary: 'Obtener solo categorías activas',
    description: 'Accesible para todos los roles. Útil para filtros en el POS.',
  })
  @ApiResponse({ status: 200, description: 'Lista de categorías activas' })
  findActive() {
    return this.categoriasService.findActive();
  }

  /**
   * Obtener categoría por ID
   * Todos los roles pueden ver detalles
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de una categoría',
    description: 'Accesible para todos los roles.',
  })
  @ApiResponse({ status: 200, description: 'Categoría encontrada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  findOne(@Param('id') id: string) {
    return this.categoriasService.findOne(id);
  }

  /**
   * Actualizar categoría
   * Solo ADMINISTRADOR puede editar categorías
   */
  @Patch(':id')
  // TODO: Descomentar cuando se implemente autenticación
  // @Roles(RolColaborador.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Actualizar una categoría',
    description: 'Solo ADMINISTRADOR. Actualiza nombre, color, icono, configuración de modificadores, etc.',
  })
  @ApiResponse({ status: 200, description: 'Categoría actualizada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 403, description: 'No tienes permisos (requiere rol ADMINISTRADOR)' })
  update(
    @Param('id') id: string,
    @Body() updateCategoriaDto: UpdateCategoriaDto,
  ) {
    return this.categoriasService.update(id, updateCategoriaDto);
  }

  /**
   * Eliminar categoría (soft delete)
   * Solo ADMINISTRADOR puede eliminar categorías
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // TODO: Descomentar cuando se implemente autenticación
  // @Roles(RolColaborador.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Eliminar una categoría (soft delete)',
    description: 'Solo ADMINISTRADOR. Desactiva la categoría pero mantiene el historial.',
  })
  @ApiResponse({ status: 204, description: 'Categoría eliminada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 403, description: 'No tienes permisos (requiere rol ADMINISTRADOR)' })
  remove(@Param('id') id: string) {
    return this.categoriasService.remove(id);
  }
}
