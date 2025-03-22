import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Lesson } from 'src/lesson/types/lesson.types';
import { Student } from 'src/student/types/student.types';
import { Teacher } from 'src/teacher/types/teacher.types';

import { Event } from 'src/event/types/event.types';
import { Announcement } from 'src/announcement/types/announcement.types';
import { Subject } from 'src/subject/types/subject.types';
import { Exam } from 'src/exam/types/exam.types';
import { Assignment } from 'src/assignment/types/assignment.types';
import { FeeStructure } from 'src/payment/types/fee.structure.type';

@ObjectType()
export class Class {
  @Field(() => String)
  id: string;

  @Field()
  name: string;

  @Field(() => Int)
  capacity: number;

  @Field(() => [Lesson])
  lessons: Lesson[];

  @Field(() => [Student], { nullable: true })
  students?: Student[];

  @Field(() => String, { nullable: true })
  supervisorId?: string;

  @Field(() => Teacher, { nullable: true })
  supervisor?: Teacher;

  @Field(() => [Exam])
  exams: Exam[];

  @Field(() => [Event])
  events: Event[];

  @Field(() => [Subject], { nullable: 'items' })
  subjects: Subject[];

  @Field(() => [Assignment])
  assignments: Assignment[];

  @Field(() => [Announcement])
  announcements: Announcement[];

  @Field(() => FeeStructure, { nullable: true })
  feeStructure?: FeeStructure;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
