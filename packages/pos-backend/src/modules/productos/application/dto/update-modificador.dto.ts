import { PartialType } from '@nestjs/swagger';
import { CreateModificadorDto } from './create-modificador.dto';

export class UpdateModificadorDto extends PartialType(CreateModificadorDto) {}
