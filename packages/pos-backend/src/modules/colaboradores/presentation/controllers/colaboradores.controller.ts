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
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ColaboradoresService } from '../../application/services/colaboradores.service';
import {
  CreateColaboradorDto,
  UpdateColaboradorDto,
} from '../../application/dto';

@ApiTags('colaboradores')
@Controller('colaboradores')
export class ColaboradoresController {
  constructor(private readonly colaboradoresService: ColaboradoresService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo colaborador' })
  @ApiResponse({ status: 201, description: 'Colaborador creado exitosamente' })
  create(@Body() createColaboradorDto: CreateColaboradorDto) {
    return this.colaboradoresService.create(createColaboradorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los colaboradores' })
  @ApiResponse({ status: 200, description: 'Lista de colaboradores' })
  findAll() {
    return this.colaboradoresService.findAll();
  }

  @Get('local/:localId')
  @ApiOperation({ summary: 'Obtener colaboradores por local' })
  @ApiQuery({
    name: 'activos',
    required: false,
    description: 'Filtrar solo activos',
  })
  @ApiResponse({ status: 200, description: 'Lista de colaboradores del local' })
  findByLocal(
    @Param('localId') localId: string,
    @Query('activos') activos?: string,
  ) {
    if (activos === 'true') {
      return this.colaboradoresService.findActiveByLocal(localId);
    }
    return this.colaboradoresService.findByLocal(localId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un colaborador por ID' })
  @ApiResponse({ status: 200, description: 'Colaborador encontrado' })
  @ApiResponse({ status: 404, description: 'Colaborador no encontrado' })
  findOne(@Param('id') id: string) {
    return this.colaboradoresService.findOne(id);
  }

  @Post(':id/validate-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar PIN de colaborador' })
  @ApiResponse({ status: 200, description: 'PIN validado' })
  async validatePin(@Param('id') id: string, @Body('pin') pin: string) {
    const valid = await this.colaboradoresService.validatePin(id, pin);
    return { valid };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un colaborador' })
  @ApiResponse({ status: 200, description: 'Colaborador actualizado' })
  @ApiResponse({ status: 404, description: 'Colaborador no encontrado' })
  update(
    @Param('id') id: string,
    @Body() updateColaboradorDto: UpdateColaboradorDto,
  ) {
    return this.colaboradoresService.update(id, updateColaboradorDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un colaborador (soft delete)' })
  @ApiResponse({ status: 204, description: 'Colaborador eliminado' })
  @ApiResponse({ status: 404, description: 'Colaborador no encontrado' })
  remove(@Param('id') id: string) {
    return this.colaboradoresService.remove(id);
  }
}
