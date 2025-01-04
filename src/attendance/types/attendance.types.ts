import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Student } from 'src/student/types/student.types';
import { Lesson } from 'src/lesson/types/lesson.types';

@ObjectType()
export class Attendance {
  @Field(() => String)
  id: string;

  @Field()
  date: Date;

  @Field()
  present: boolean;

  @Field()
  studentId: string;

  @Field(() => Student)
  student: Student;

  @Field(() => Int)
  lessonId: number;

  @Field(() => Lesson)
  lesson: Lesson;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
