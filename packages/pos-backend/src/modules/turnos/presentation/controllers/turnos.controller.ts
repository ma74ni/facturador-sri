import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TurnosService } from '../../application/services/turnos.service';
import { AbrirCajaDto, CerrarCajaDto } from '../../application/dto';

@ApiTags('turnos')
@Controller('turnos')
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}

  @Post('abrir')
  @ApiOperation({ summary: 'Abrir caja / Iniciar turno' })
  @ApiResponse({ status: 201, description: 'Caja abierta exitosamente' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un turno abierto en este local',
  })
  abrirCaja(@Body() abrirCajaDto: AbrirCajaDto) {
    return this.turnosService.abrirCaja(abrirCajaDto);
  }

  @Post(':id/cerrar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar caja / Finalizar turno' })
  @ApiResponse({
    status: 200,
    description: 'Caja cerrada exitosamente con resumen',
  })
  @ApiResponse({ status: 404, description: 'Turno no encontrado' })
  @ApiResponse({ status: 400, description: 'El turno ya está cerrado' })
  cerrarCaja(@Param('id') id: string, @Body() cerrarCajaDto: CerrarCajaDto) {
    return this.turnosService.cerrarCaja(id, cerrarCajaDto);
  }

  @Get('activo/local/:localId')
  @ApiOperation({ summary: 'Obtener turno activo por local' })
  @ApiResponse({ status: 200, description: 'Turno activo encontrado o null' })
  getTurnoActivo(@Param('localId') localId: string) {
    return this.turnosService.getTurnoActivo(localId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un turno por ID' })
  @ApiResponse({ status: 200, description: 'Turno encontrado' })
  @ApiResponse({ status: 404, description: 'Turno no encontrado' })
  findOne(@Param('id') id: string) {
    return this.turnosService.findOne(id);
  }

  @Get('local/:localId')
  @ApiOperation({ summary: 'Obtener turnos por local' })
  @ApiQuery({ name: 'skip', required: false, description: 'Saltar N registros' })
  @ApiQuery({ name: 'take', required: false, description: 'Tomar N registros' })
  @ApiQuery({
    name: 'includeOpen',
    required: false,
    description: 'Incluir turno abierto',
  })
  @ApiResponse({ status: 200, description: 'Lista de turnos' })
  findByLocal(
    @Param('localId') localId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('includeOpen') includeOpen?: string,
  ) {
    return this.turnosService.findByLocal(localId, {
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      includeOpen: includeOpen === 'true',
    });
  }
}
