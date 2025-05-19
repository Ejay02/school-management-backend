import { InputType } from '@nestjs/graphql';
import { CreateAssignmentInput } from './create.assignment.input';

@InputType()
export class EditAssignmentInput extends CreateAssignmentInput {}
