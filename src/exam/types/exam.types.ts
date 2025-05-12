import { Field, ObjectType } from '@nestjs/graphql';
import { Class } from 'src/class/types/class.types';
import { Subject } from 'src/subject/types/subject.types';
import { Teacher } from 'src/teacher/types/teacher.types';
import { Result } from 'src/result/types/result.types';
import GraphQLJSON from 'graphql-type-json';
import { Question } from 'src/shared/question/types/question.types';
import { StudentExam } from './student-exam.types';

@ObjectType()
export class Exam {
  @Field(() => String)
  id: string;

  @Field()
  title: string;

  @Field()
  startTime: Date;

  @Field()
  endTime: Date;

  @Field()
  date: Date;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  instructions?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  content?: any;

  @Field(() => [Question], { nullable: true })
  questions?: Question[];

  @Field(() => String)
  classId: string;

  @Field(() => Class)
  class: Class;

  @Field(() => String)
  subjectId: string;

  @Field(() => Subject)
  subject: Subject;

  @Field(() => String)
  teacherId: string;

  @Field(() => Teacher)
  teacher: Teacher;

  @Field(() => [Result])
  results: Result[];

  @Field(() => [StudentExam], { nullable: 'itemsAndList' })
  exams?: StudentExam[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
