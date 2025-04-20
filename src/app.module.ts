import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { SubjectModule } from './subject/subject.module';
import { LessonModule } from './lesson/lesson.module';
import { ClassModule } from './class/class.module';
import { StudentModule } from './student/student.module';
import { ParentModule } from './parent/parent.module';
import { GradeModule } from './grade/grade.module';
import { ExamModule } from './exam/exam.module';
import { AssignmentModule } from './assignment/assignment.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ResultModule } from './result/result.module';
import { EventModule } from './event/event.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { TeacherModule } from './teacher/teacher.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppResolver } from './app.resolver';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './shared/auth/auth.module';
import { SubmissionModule } from './submission/submission.module';
import { MailModule } from './mail/mail.module';
import { PaymentModule } from './payment/payment.module';
import { UserModule } from './shared/user/user.module';
import { ScheduleModule } from '@nestjs/schedule';

import { SchedulingModule } from './shared/task/scheduling.module';
import { SecurityModule } from './shared/security/security.module';
import { join } from 'path';
import { QuestionModule } from './shared/question/question.module';
import GraphQLJSON from 'graphql-type-json';
import { CloudinaryModule } from './shared/cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      context: ({ req }) => ({ req }),
      playground: {
        settings: {
          'request.credentials': 'include',
        },
      },
      resolvers: { JSON: GraphQLJSON },
    }),
    AdminModule,
    TeacherModule,
    SubjectModule,
    LessonModule,
    ClassModule,
    StudentModule,
    ParentModule,
    GradeModule,
    ExamModule,
    AssignmentModule,
    AttendanceModule,
    ResultModule,
    EventModule,
    AnnouncementModule,
    PrismaModule,
    AuthModule,
    SubmissionModule,
    MailModule,
    PaymentModule,
    UserModule,
    SchedulingModule,
    SecurityModule,
    QuestionModule,
    CloudinaryModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppResolver],
})
export class AppModule {}
