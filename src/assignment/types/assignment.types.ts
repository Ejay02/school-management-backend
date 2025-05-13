import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Lesson } from 'src/lesson/types/lesson.types';
import { Result } from 'src/result/types/result.types';
import { Teacher } from 'src/teacher/types/teacher.types';
import { Subject } from 'src/subject/types/subject.types';
import { Class } from 'src/class/types/class.types';
import { Submission } from 'src/submission/types/submission.types';
import GraphQLJSON from 'graphql-type-json';
import { Question } from 'src/shared/question/types/question.types';

@ObjectType()
export class Assignment {
  @Field(() => String)
  id: string;

  @Field()
  title: string;

  @Field()
  startDate: Date;

  @Field()
  dueDate: Date;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  instructions?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  content?: any;

  @Field(() => [Question], { nullable: true })
  questions?: Question[];

  @Field(() => Int)
  lessonId: string;

  @Field(() => Lesson)
  lesson: Lesson;

  @Field(() => [Result])
  result: Result[];

  @Field(() => String)
  teacherId: string;

  @Field(() => Teacher)
  teacher: Teacher;

  @Field(() => Int)
  subjectId: string;

  @Field(() => Subject)
  subject: Subject;

  @Field(() => Int)
  classId: string;

  @Field(() => Class)
  class: Class;

  @Field(() => [Submission])
  submissions: Submission[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
