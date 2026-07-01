import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Student } from '../../student/types/student.types';
import { Lesson } from '../../lesson/types/lesson.types';
import { Class } from '../../class/types/class.types';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EARLY_LEAVE = 'EARLY_LEAVE',
  EXCUSED_ABSENT = 'EXCUSED_ABSENT',
}

registerEnumType(AttendanceStatus, { name: 'AttendanceStatus' });

@ObjectType()
export class Attendance {
  @Field()
  id: string;

  @Field()
  date: Date;

  @Field()
  present: boolean;

  @Field(() => AttendanceStatus)
  status: AttendanceStatus;

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  reasonCode?: string;

  @Field({ nullable: true })
  note?: string;

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

@ObjectType()
export class AttendanceSessionToken {
  @Field()
  token: string;

  @Field()
  expiresAt: Date;

  @Field()
  qrPayload: string;
}
