import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TaxCodesService } from '../../application/services/tax-codes.service';
import { TaxCodeDto, TaxCodesResponseDto } from '../../application/dto/tax-code.dto';

@ApiTags('Tax Codes')
@Controller('tax-codes')
export class TaxCodesController {
  constructor(private readonly taxCodesService: TaxCodesService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los códigos de impuesto',
    description:
      'Retorna todos los códigos de impuesto (IVA) disponibles según las regulaciones del SRI Ecuador, ' +
      'incluyendo los códigos más comunes y la fecha de última actualización.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de códigos de impuesto obtenida exitosamente',
    type: TaxCodesResponseDto,
  })
  getAllTaxCodes(): TaxCodesResponseDto {
    return this.taxCodesService.getAllTaxCodes();
  }

  @Get('common')
  @ApiOperation({
    summary: 'Obtener códigos de impuesto más comunes',
    description: 'Retorna solo los códigos de impuesto más utilizados para facilitar la selección en formularios.',
  })
  @ApiResponse({
    status: 200,
    description: 'Códigos comunes obtenidos exitosamente',
    type: [TaxCodeDto],
  })
  getCommonTaxCodes(): TaxCodeDto[] {
    return this.taxCodesService.getCommonTaxCodes();
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Obtener un código de impuesto específico',
    description: 'Retorna la información de un código de impuesto específico por su código.',
  })
  @ApiParam({
    name: 'code',
    description: 'Código del impuesto (ej: 2, 0, 6, 7)',
    example: '2',
  })
  @ApiResponse({
    status: 200,
    description: 'Código de impuesto encontrado',
    type: TaxCodeDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Código de impuesto no encontrado',
  })
  getTaxCodeByCode(@Param('code') code: string): TaxCodeDto | null {
    return this.taxCodesService.getTaxCodeByCode(code);
  }
}
