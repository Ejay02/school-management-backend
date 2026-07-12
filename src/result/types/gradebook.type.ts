import { Field, Float, ObjectType, ID } from '@nestjs/graphql';

@ObjectType()
export class GradebookStudent {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  surname: string;
}

@ObjectType()
export class GradebookColumn {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  type: string; // "ASSIGNMENT" or "EXAM"
}

@ObjectType()
export class GradebookCell {
  @Field()
  studentId: string;

  @Field()
  columnId: string; // assignmentId or examId

  @Field({ nullable: true })
  resultId?: string;

  @Field(() => Float, { nullable: true })
  score?: number;
}

@ObjectType()
export class GradebookPayload {
  @Field(() => [GradebookStudent])
  students: GradebookStudent[];

  @Field(() => [GradebookColumn])
  columns: GradebookColumn[];

  @Field(() => [GradebookCell])
  cells: GradebookCell[];
}
