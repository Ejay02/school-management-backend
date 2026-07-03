import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { Term } from 'src/payment/enum/term';
import { Roles } from 'src/shared/enum/role';
import { TermReportStatus } from '../enum/term-report-status';

@ObjectType()
export class TermReportSubjectGrade {
  @Field(() => String)
  name: string;

  @Field(() => Float, { nullable: true })
  examAverage?: number | null;

  @Field(() => Float, { nullable: true })
  assignmentAverage?: number | null;

  @Field(() => Float, { nullable: true })
  finalScore?: number | null;
}

@ObjectType()
export class TermReportAttendanceSummary {
  @Field(() => Int)
  presentClasses: number;

  @Field(() => Int)
  absentClasses: number;

  @Field(() => Int)
  totalClasses: number;

  @Field(() => Float)
  attendanceRate: number;
}

@ObjectType()
export class TermReportPosition {
  @Field(() => Int, { nullable: true })
  position?: number | null;

  @Field(() => Int)
  totalStudents: number;
}

@ObjectType()
export class TermReportReadiness {
  @Field(() => Boolean)
  ready: boolean;

  @Field(() => [String])
  issues: string[];
}

@ObjectType()
export class TermReportRemark {
  @Field(() => String)
  id: string;

  @Field(() => String)
  studentId: string;

  @Field(() => String)
  classId: string;

  @Field(() => String)
  academicPeriod: string;

  @Field(() => Term)
  term: Term;

  @Field(() => String)
  remark: string;

  @Field(() => String, { nullable: true })
  authorId?: string | null;

  @Field(() => Roles, { nullable: true })
  authorRole?: Roles | null;

  @Field(() => TermReportStatus)
  status: TermReportStatus;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date | null;

  @Field(() => String, { nullable: true })
  publishedById?: string | null;

  @Field(() => Roles, { nullable: true })
  publishedByRole?: Roles | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class StudentTermReport {
  @Field(() => String)
  studentId: string;

  @Field(() => String)
  studentName: string;

  @Field(() => String, { nullable: true })
  studentCode?: string | null;

  @Field(() => String)
  classId: string;

  @Field(() => String)
  className: string;

  @Field(() => String)
  academicPeriod: string;

  @Field(() => Term)
  term: Term;

  @Field(() => String, { nullable: true })
  schoolName?: string | null;

  @Field(() => String, { nullable: true })
  schoolLogo?: string | null;

  @Field(() => String, { nullable: true })
  schoolAddress?: string | null;

  @Field(() => Float, { nullable: true })
  overallAverage?: number | null;

  @Field(() => TermReportStatus)
  status: TermReportStatus;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date | null;

  @Field(() => String, { nullable: true })
  publishedById?: string | null;

  @Field(() => Roles, { nullable: true })
  publishedByRole?: Roles | null;

  @Field(() => TermReportPosition)
  ranking: TermReportPosition;

  @Field(() => TermReportAttendanceSummary)
  attendance: TermReportAttendanceSummary;

  @Field(() => TermReportReadiness)
  readiness: TermReportReadiness;

  @Field(() => [TermReportSubjectGrade])
  subjectGrades: TermReportSubjectGrade[];

  @Field(() => TermReportRemark, { nullable: true })
  remark?: TermReportRemark | null;
}

@ObjectType()
export class StudentTermReportSummary {
  @Field(() => String)
  studentId: string;

  @Field(() => String)
  studentName: string;

  @Field(() => Float, { nullable: true })
  overallAverage?: number | null;

  @Field(() => Float)
  attendanceRate: number;

  @Field(() => Int, { nullable: true })
  position?: number | null;

  @Field(() => Int)
  totalStudents: number;

  @Field(() => TermReportStatus)
  status: TermReportStatus;

  @Field(() => TermReportReadiness)
  readiness: TermReportReadiness;
}
