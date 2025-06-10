import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Lesson } from '../../lesson/types/lesson.types';
import { Student } from '../../student/types/student.types';
import { Teacher } from '../../teacher/types/teacher.types';

import { Event } from '../../event/types/event.types';
import { Announcement } from '../../announcement/types/announcement.types';
import { Subject } from '../../subject/types/subject.types';
import { Exam } from '../../exam/types/exam.types';
import { Assignment } from '../../assignment/types/assignment.types';
import { FeeStructure } from '../../payment/types/fee.structure.type';

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
