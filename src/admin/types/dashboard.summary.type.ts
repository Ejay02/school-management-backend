import { ObjectType, Field, Int } from '@nestjs/graphql';
import { OnboardingChecklist } from '../../setup/types/setup.types';
import { InvitationSummary } from '../../invitation/types/invitation.types';
import { Invoice } from '../../payment/types/invoice.type';
import { FinanceOverview } from '../../payment/types/billing.report.dashboard.type';

@ObjectType()
export class AcademicYear {
  @Field(() => String)
  current: string;

  @Field(() => String)
  next: string;
}

@ObjectType()
export class Counts {
  @Field(() => Int)
  students: number;

  @Field(() => Int)
  parents: number;

  @Field(() => Int)
  teachers: number;

  @Field(() => Int)
  admins: number;
}

@ObjectType()
export class DashboardSummary {
  @Field(() => String)
  role: string;

  @Field(() => AcademicYear)
  academicYear: AcademicYear;

  @Field(() => Counts)
  counts: Counts;
}

@ObjectType()
export class AdminDashboardOverview {
  @Field(() => DashboardSummary)
  dashboardSummary: DashboardSummary;

  @Field(() => OnboardingChecklist)
  onboardingChecklist: OnboardingChecklist;

  @Field(() => InvitationSummary)
  invitationSummary: InvitationSummary;

  @Field(() => [Invoice])
  invoicesDueThisWeek: Invoice[];

  @Field(() => FinanceOverview)
  financeOverview: FinanceOverview;
}
