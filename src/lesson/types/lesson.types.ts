import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Class } from 'src/class/types/class.types';
import { Subject } from 'src/subject/types/subject.types';
import { Teacher } from 'src/teacher/types/teacher.types';
import { Exam } from 'src/exam/types/exam.types';
import { Assignment } from 'src/assignment/types/assignment.types';
import { Attendance } from 'src/attendance/types/attendance.types';
import { Student } from 'src/student/types/student.types';

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

  @Field(() => Int)
  subjectId: string;

  @Field(() => Subject)
  subject: Subject;

  @Field(() => Int)
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
