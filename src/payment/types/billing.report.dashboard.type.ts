import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class StatusDistribution {
  @Field(() => String)
  status: string;

  @Field(() => Int)
  count: number;

  @Field(() => Float)
  percentage: number;
}

@ObjectType()
export class TopClassByRevenue {
  @Field(() => String)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => Float)
  revenue: number;
}

@ObjectType()
export class RevenueTrendData {
  @Field(() => [String])
  months: string[];

  @Field(() => [Float])
  data: number[];
}

@ObjectType()
export class TotalRevenueData {
  @Field(() => Float)
  amount: number;

  @Field(() => Float)
  growthPercentage: number;
}

@ObjectType()
export class OutstandingPaymentsData {
  @Field(() => Float)
  amount: number;

  @Field(() => Int)
  overdueCount: number;

  @Field(() => Float)
  overduePercentage: number;
}

@ObjectType()
export class CollectionRateData {
  @Field(() => Float)
  rate: number;

  @Field(() => Float)
  targetRate: number;
}

@ObjectType()
export class PaymentStatusDistributionData {
  @Field(() => [String])
  labels: string[];

  @Field(() => [Float])
  data: number[];
}

@ObjectType()
export class BillingReportDashboard {
  @Field(() => TotalRevenueData)
  totalRevenue: TotalRevenueData;

  @Field(() => OutstandingPaymentsData)
  outstandingPayments: OutstandingPaymentsData;

  @Field(() => CollectionRateData)
  collectionRate: CollectionRateData;

  @Field(() => RevenueTrendData)
  revenueTrend: RevenueTrendData;

  @Field(() => PaymentStatusDistributionData)
  paymentStatusDistribution: PaymentStatusDistributionData;

  @Field(() => [TopClassByRevenue])
  topClassesByRevenue: TopClassByRevenue[];
}
