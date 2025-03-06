import { Field, ObjectType } from '@nestjs/graphql';
import { Student } from 'src/student/types/student.types';
import { Lesson } from 'src/lesson/types/lesson.types';
import { Class } from 'src/class/types/class.types';

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
