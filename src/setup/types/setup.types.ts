import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { Term } from 'src/payment/enum/term';

@ObjectType()
export class SetupState {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  schoolName?: string;

  @Field(() => String, { nullable: true })
  schoolEmail?: string;

  @Field(() => String, { nullable: true })
  schoolPhone?: string;

  @Field(() => String, { nullable: true })
  schoolAddress?: string;

  @Field(() => String, { nullable: true })
  academicYearCurrent?: string;

  @Field(() => String, { nullable: true })
  academicYearNext?: string;

  @Field(() => Term, { nullable: true })
  currentTerm?: Term;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class SetupStep {
  @Field(() => String)
  key: string;

  @Field(() => String)
  label: string;

  @Field(() => Boolean)
  completed: boolean;

  @Field(() => String)
  value: string;
}

@ObjectType()
export class SetupProgress {
  @Field(() => SetupState)
  state: SetupState;

  @Field(() => [SetupStep])
  steps: SetupStep[];

  @Field(() => Int)
  completedSteps: number;

  @Field(() => Int)
  totalSteps: number;

  @Field(() => Float)
  completionPercentage: number;
}

