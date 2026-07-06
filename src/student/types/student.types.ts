import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Parent } from '../../parent/types/parent.types';
import { Class } from '../../class/types/class.types';

import { Attendance } from '../../attendance/types/attendance.types';
import { Result } from '../../result/types/result.types';
import { StudentExam } from '../../exam/types/student-exam.types';
import { Roles } from '../../shared/enum/role';

@ObjectType()
export class Student {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  studentId?: string;

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
  institutionalEmail?: string;

  @Field({ nullable: true }) // Don't expose password in GraphQL responses
  password?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  image?: string;

  @Field({ nullable: true })
  bloodType?: string;

  @Field({ nullable: true })
  sex?: string;

  @Field({ nullable: true })
  dateOfBirth?: Date;

  @Field({ nullable: true })
  aboutMe?: string;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  deactivatedAt?: Date;

  @Field()
  parentId: string;

  @Field(() => Parent, { nullable: true })
  parent?: Parent;

  @Field()
  classId: string;

  @Field(() => Class, { nullable: true })
  class?: Class;

  @Field(() => [Attendance], { nullable: 'itemsAndList' })
  attendances?: Attendance[];

  @Field()
  resultId: string;

  @Field(() => [Result], { nullable: 'itemsAndList' })
  result?: Result[];

  @Field(() => [StudentExam], { nullable: 'itemsAndList' })
  exams?: StudentExam[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class StudentDueAssignmentTask {
  @Field(() => String)
  assignmentId: string;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  subjectName?: string | null;

  @Field(() => Date)
  dueDate: Date;

  @Field(() => Boolean)
  submitted: boolean;

  @Field(() => Boolean)
  overdue: boolean;

  @Field(() => String)
  statusLabel: string;
}

@ObjectType()
export class StudentUpcomingExamTask {
  @Field(() => String)
  studentExamId: string;

  @Field(() => String)
  examId: string;

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

  @Field(() => Boolean)
  hasTaken: boolean;

  @Field(() => Boolean)
  missed: boolean;

  @Field(() => String)
  statusLabel: string;
}

@ObjectType()
export class StudentTodayOverview {
  @Field(() => Int)
  dueAssignmentCount: number;

  @Field(() => Int)
  overdueAssignmentCount: number;

  @Field(() => Int)
  upcomingExamCount: number;

  @Field(() => [StudentDueAssignmentTask])
  dueAssignments: StudentDueAssignmentTask[];

  @Field(() => [StudentUpcomingExamTask])
  upcomingExams: StudentUpcomingExamTask[];
}
