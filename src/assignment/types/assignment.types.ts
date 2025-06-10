import { Field, ObjectType } from '@nestjs/graphql';
import { Lesson } from '../../lesson/types/lesson.types';
import { Result } from '../../result/types/result.types';
import { Teacher } from '../../teacher/types/teacher.types';
import { Subject } from '../../subject/types/subject.types';
import { Class } from '../../class/types/class.types';
import { Submission } from '../../submission/types/submission.types';
import GraphQLJSON from 'graphql-type-json';
import { Question } from '../../shared/question/types/question.types';

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

  @Field(() => String)
  lessonId: string;

  @Field(() => Lesson, { nullable: true })
  lesson: Lesson;

  @Field(() => [Result])
  result: Result[];

  @Field(() => String)
  teacherId: string;

  @Field(() => Teacher, { nullable: true })
  teacher: Teacher;

  @Field(() => String)
  subjectId: string;

  @Field(() => Subject, { nullable: true })
  subject: Subject;

  @Field(() => String)
  classId: string;

  @Field(() => Class, { nullable: true })
  class: Class;

  @Field(() => [Submission])
  submissions: Submission[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
