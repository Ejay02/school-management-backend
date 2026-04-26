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
  schoolLogo?: string;

  @Field(() => String, { nullable: true })
  schoolContactName?: string;

  @Field(() => String, { nullable: true })
  schoolTimezone?: string;

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

@ObjectType()
export class OnboardingChecklistStepMeta {
  @Field(() => Int, {
    nullable: true,
    description: 'Generic count (e.g., number of classes or invites sent).',
  })
  count?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Generic total (e.g., total number of classes).',
  })
  total?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Invitation count with ACCEPTED status.',
  })
  accepted?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Invitation count with PENDING status.',
  })
  pending?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Invitation count with EXPIRED status.',
  })
  expired?: number;
}

@ObjectType()
export class OnboardingChecklistStep {
  @Field(() => String)
  key: string;

  @Field(() => String)
  label: string;

  @Field(() => Boolean)
  complete: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Short human-friendly summary for rendering onboarding cards.',
  })
  summary?: string;

  @Field(() => OnboardingChecklistStepMeta, {
    nullable: true,
    description: 'Optional structured metadata for counts/ratios.',
  })
  meta?: OnboardingChecklistStepMeta;
}

@ObjectType()
export class OnboardingChecklist {
  @Field(() => [OnboardingChecklistStep], {
    description:
      'Ordered list of onboarding checklist steps for rendering onboarding cards.',
  })
  steps: OnboardingChecklistStep[];

  @Field(() => Int)
  completedSteps: number;

  @Field(() => Int)
  totalSteps: number;

  @Field(() => Float)
  completionPercentage: number;
}
