import { Field, ObjectType } from '@nestjs/graphql';
import { Class } from '../../class/types/class.types';
import { Subject } from '../../subject/types/subject.types';
import { Teacher } from '../../teacher/types/teacher.types';
import { Exam } from '../../exam/types/exam.types';
import { Assignment } from '../../assignment/types/assignment.types';
import { Attendance } from '../../attendance/types/attendance.types';
import { Student } from '../../student/types/student.types';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class Lesson {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  day: string;

  @Field()
  startTime: string;

  @Field()
  endTime: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  content?: any;

  @Field(() => String)
  subjectId: string;

  @Field(() => Subject)
  subject: Subject;

  @Field(() => String)
  classId: string;

  @Field(() => Class)
  class: Class;

  @Field()
  teacherId: string;

  @Field(() => Teacher, { nullable: true })
  teacher?: Teacher;

  @Field(() => [Student], { nullable: true })
  students?: Student[];

  @Field(() => [Exam])
  exams: Exam[];

  @Field(() => [Assignment])
  assignments: Assignment[];

  @Field(() => [Attendance])
  attendances: Attendance[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
