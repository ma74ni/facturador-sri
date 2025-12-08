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
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ModificadoresService } from '../../application/services/modificadores.service';
import {
  CreateModificadorDto,
  UpdateModificadorDto,
  TipoModificador,
} from '../../application/dto';

@ApiTags('modificadores')
@Controller('modificadores')
export class ModificadoresController {
  constructor(private readonly modificadoresService: ModificadoresService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo modificador' })
  @ApiResponse({ status: 201, description: 'Modificador creado exitosamente' })
  create(@Body() createModificadorDto: CreateModificadorDto) {
    return this.modificadoresService.create(createModificadorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los modificadores' })
  @ApiResponse({ status: 200, description: 'Lista de modificadores' })
  findAll() {
    return this.modificadoresService.findAll();
  }

  @Get('disponibles')
  @ApiOperation({ summary: 'Obtener solo modificadores disponibles' })
  @ApiResponse({ status: 200, description: 'Lista de modificadores disponibles' })
  findDisponibles() {
    return this.modificadoresService.findDisponibles();
  }

  @Get('grouped')
  @ApiOperation({ summary: 'Obtener modificadores agrupados por tipo' })
  @ApiResponse({
    status: 200,
    description: 'Modificadores agrupados por SABOR, TOPPING, ADEREZO, SUSTITUCION',
  })
  findGroupedByTipo() {
    return this.modificadoresService.findGroupedByTipo();
  }

  @Get('tipo/:tipo')
  @ApiParam({
    name: 'tipo',
    enum: TipoModificador,
    description: 'Tipo de modificador',
  })
  @ApiOperation({ summary: 'Obtener modificadores por tipo' })
  @ApiResponse({ status: 200, description: 'Lista de modificadores del tipo especificado' })
  findByTipo(@Param('tipo') tipo: TipoModificador) {
    return this.modificadoresService.findByTipo(tipo);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un modificador por ID' })
  @ApiResponse({ status: 200, description: 'Modificador encontrado' })
  @ApiResponse({ status: 404, description: 'Modificador no encontrado' })
  findOne(@Param('id') id: string) {
    return this.modificadoresService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un modificador' })
  @ApiResponse({ status: 200, description: 'Modificador actualizado' })
  @ApiResponse({ status: 404, description: 'Modificador no encontrado' })
  update(
    @Param('id') id: string,
    @Body() updateModificadorDto: UpdateModificadorDto,
  ) {
    return this.modificadoresService.update(id, updateModificadorDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un modificador (soft delete)' })
  @ApiResponse({ status: 204, description: 'Modificador eliminado' })
  @ApiResponse({ status: 404, description: 'Modificador no encontrado' })
  remove(@Param('id') id: string) {
    return this.modificadoresService.remove(id);
  }
}
