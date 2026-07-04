import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Subject } from '../../subject/types/subject.types';
import { Lesson } from '../../lesson/types/lesson.types';
import { Class } from '../../class/types/class.types';
import { Roles } from '../../shared/enum/role';
import { Term } from '../../payment/enum/term';

@ObjectType()
export class Teacher {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  teacherId?: string;

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

  @Field({ nullable: true })
  password: string;

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
  aboutMe?: string;

  @Field({ nullable: true })
  dateOfBirth?: Date;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  deactivatedAt?: Date;

  @Field(() => [Subject])
  subjects: Subject[];

  @Field(() => [Lesson])
  lessons: Lesson[];

  @Field(() => [Class])
  classes: Class[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class TeacherTodayClass {
  @Field(() => String)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  className?: string | null;

  @Field(() => String, { nullable: true })
  subjectName?: string | null;

  @Field(() => String)
  startTime: string;

  @Field(() => String)
  endTime: string;
}

@ObjectType()
export class TeacherTodayOverview {
  @Field(() => [TeacherTodayClass])
  nextClasses: TeacherTodayClass[];

  @Field(() => Int)
  attendanceDueCount: number;

  @Field(() => Int)
  assignmentsToGradeCount: number;

  @Field(() => String, { nullable: true })
  supervisorAcademicPeriod?: string | null;

  @Field(() => Term, { nullable: true })
  supervisorCurrentTerm?: Term | null;

  @Field(() => Int)
  supervisorRemarkPendingCount: number;

  @Field(() => Int)
  supervisorRemarkCompletedCount: number;

  @Field(() => [TeacherSupervisorRemarkTask])
  supervisorRemarkTasks: TeacherSupervisorRemarkTask[];
}

@ObjectType()
export class TeacherSupervisorRemarkTask {
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

  @Field(() => Boolean)
  completed: boolean;

  @Field(() => Boolean)
  locked: boolean;

  @Field(() => String, { nullable: true })
  remark?: string | null;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date | null;
}
