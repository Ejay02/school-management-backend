import { Field, ObjectType } from '@nestjs/graphql';
import { Student } from '../../student/types/student.types';
import { Lesson } from '../../lesson/types/lesson.types';
import { Class } from '../../class/types/class.types';

@ObjectType()
export class Attendance {
  @Field()
  id: string;

  @Field()
  date: Date;

  @Field()
  present: boolean;

  @Field()
  studentId: string;

  @Field(() => Student)
  student: Student;

  @Field()
  lessonId: string;

  @Field(() => Lesson)
  lesson: Lesson;

  @Field()
  classId: string;

  @Field(() => Class)
  class: Class;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
