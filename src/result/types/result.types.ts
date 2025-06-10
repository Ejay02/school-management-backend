import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Exam } from '../../exam/types/exam.types';
import { Assignment } from '../../assignment/types/assignment.types';
import { Student } from '../../student/types/student.types';
import { ResultType } from '../../result/enum/resultType';
import { Subject } from '../../subject/types/subject.types';
import { Term } from '../../payment/enum/term';

@ObjectType()
export class Result {
  @Field(() => String)
  id: string;

  @Field(() => Int)
  score: number;

  @Field(() => Exam, { nullable: true })
  exam?: Exam;

  @Field(() => Int, { nullable: true })
  examId?: number;

  @Field(() => Assignment, { nullable: true })
  assignment?: Assignment;

  @Field(() => Int, { nullable: true })
  assignmentId?: number;

  @Field()
  studentId: string;

  @Field(() => Student)
  student: Student;

  @Field(() => ResultType, { nullable: true })
  type?: ResultType;

  @Field(() => [Subject], { nullable: true })
  subjects?: Subject[];

  @Field(() => String, { nullable: true })
  academicPeriod?: string;

  @Field(() => Term, { nullable: true })
  term?: Term;

  @Field(() => String, { nullable: true })
  comments?: string;

  @Field(() => Boolean)
  isOfficialResult: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
