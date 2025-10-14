import { PartialType } from '@nestjs/swagger';
import { CreateEmissionPointDto } from './create-emission-point.dto';

export class UpdateEmissionPointDto extends PartialType(CreateEmissionPointDto) {}