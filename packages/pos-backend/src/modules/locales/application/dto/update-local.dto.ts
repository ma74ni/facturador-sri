import { PartialType } from '@nestjs/swagger';
import { CreateLocalDto } from './create-local.dto';

export class UpdateLocalDto extends PartialType(CreateLocalDto) {}
