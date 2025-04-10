import { InputType, PartialType } from '@nestjs/graphql';
import { CreateClassInput } from './create.class.input';

@InputType()
export class UpdateClassInput extends PartialType(CreateClassInput) {}
