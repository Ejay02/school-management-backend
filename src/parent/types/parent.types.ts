import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Student } from '../../student/types/student.types';
import { Roles } from '../../shared/enum/role';

@ObjectType()
export class Parent {
  @Field(() => ID)
  id: string;

  @Field()
  username: string;

  @Field(() => Roles)
  role: Roles;

  @Field()
  name: string;

  @Field()
  surname: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  password: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  image?: string;

  @Field({ nullable: true })
  aboutMe?: string;

  @Field()
  feeReminderOptOut: boolean;

  @Field()
  weeklyDigestOptOut: boolean;

  @Field({ nullable: true })
  dateOfBirth?: Date;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  deactivatedAt?: Date;

  @Field(() => [Student])
  students: Student[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class ParentChildAssignmentTask {
  @Field(() => String)
  studentId: string;

  @Field(() => String)
  studentName: string;

  @Field(() => String, { nullable: true })
  className?: string | null;

  @Field(() => String)
  assignmentId: string;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  subjectName?: string | null;

  @Field(() => Date)
  dueDate: Date;

  @Field()
  overdue: boolean;

  @Field(() => String)
  statusLabel: string;
}

@ObjectType()
export class ParentChildExamTask {
  @Field(() => String)
  studentId: string;

  @Field(() => String)
  studentName: string;

  @Field(() => String, { nullable: true })
  className?: string | null;

  @Field(() => String)
  examId: string;

  @Field(() => String)
  studentExamId: string;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  subjectName?: string | null;

  @Field(() => Date)
  date: Date;

  @Field(() => Date)
  startTime: Date;

  @Field(() => Date)
  endTime: Date;

  @Field()
  missed: boolean;

  @Field(() => String)
  statusLabel: string;
}

@ObjectType()
export class ParentSchoolNotice {
  @Field(() => String)
  eventId: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  category: string;

  @Field(() => String)
  statusLabel: string;

  @Field(() => Date)
  startTime: Date;

  @Field(() => Date)
  endTime: Date;

  @Field(() => String, { nullable: true })
  location?: string | null;

  @Field(() => String, { nullable: true })
  className?: string | null;
}

@ObjectType()
export class ParentTodayOverview {
  @Field(() => Int)
  linkedStudentCount: number;

  @Field(() => Int)
  pendingAssignmentCount: number;

  @Field(() => Int)
  overdueAssignmentCount: number;

  @Field(() => Int)
  upcomingExamCount: number;

  @Field(() => [ParentChildAssignmentTask])
  assignmentTasks: ParentChildAssignmentTask[];

  @Field(() => [ParentChildExamTask])
  examTasks: ParentChildExamTask[];

  @Field(() => [ParentSchoolNotice])
  schoolNotices: ParentSchoolNotice[];
}
