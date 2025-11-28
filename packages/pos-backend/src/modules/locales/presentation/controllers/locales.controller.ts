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
import { LocalesService } from '../../application/services/locales.service';
import { CreateLocalDto, UpdateLocalDto } from '../../application/dto';

@ApiTags('locales')
@Controller('locales')
export class LocalesController {
  constructor(private readonly localesService: LocalesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo local' })
  @ApiResponse({ status: 201, description: 'Local creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El código del local ya existe' })
  create(@Body() createLocalDto: CreateLocalDto) {
    return this.localesService.create(createLocalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los locales' })
  @ApiResponse({ status: 200, description: 'Lista de locales' })
  findAll() {
    return this.localesService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener solo locales activos' })
  @ApiResponse({ status: 200, description: 'Lista de locales activos' })
  findActive() {
    return this.localesService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un local por ID' })
  @ApiResponse({ status: 200, description: 'Local encontrado' })
  @ApiResponse({ status: 404, description: 'Local no encontrado' })
  findOne(@Param('id') id: string) {
    return this.localesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un local' })
  @ApiResponse({ status: 200, description: 'Local actualizado' })
  @ApiResponse({ status: 404, description: 'Local no encontrado' })
  update(@Param('id') id: string, @Body() updateLocalDto: UpdateLocalDto) {
    return this.localesService.update(id, updateLocalDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un local (soft delete)' })
  @ApiResponse({ status: 204, description: 'Local eliminado' })
  @ApiResponse({ status: 404, description: 'Local no encontrado' })
  remove(@Param('id') id: string) {
    return this.localesService.remove(id);
  }
}
