import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { SubjectModule } from './subject/subject.module';
import { LessonModule } from './lesson/lesson.module';
import { ClassModule } from './class/class.module';
import { StudentModule } from './student/student.module';
import { ParentModule } from './parent/parent.module';
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
import { join } from 'node:path';
import { QuestionModule } from './shared/question/question.module';
import GraphQLJSON from 'graphql-type-json';
import { CloudinaryModule } from './shared/cloudinary/cloudinary.module';
import { InvitationModule } from './invitation/invitation.module';
import { SetupModule } from './setup/setup.module';
import { AiModule } from './ai/ai.module';
import { ContactModule } from './contact/contact.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditContextInterceptor } from './shared/audit/audit-context.interceptor';
import { AuditModule } from './shared/audit/audit.module';
import { ChatModule } from './chat/chat.module';
import { TermReportModule } from './term-report/term-report.module';
import type { GraphQLFormattedError } from 'graphql';

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
      formatError: (
        formattedError: GraphQLFormattedError,
        error: unknown,
      ): GraphQLFormattedError => {
        const code = (formattedError.extensions as any)?.code;
        const rootPath = Array.isArray(formattedError.path)
          ? String(formattedError.path[0] ?? '')
          : '';

        if (code === 'INTERNAL_SERVER_ERROR') {
          let message = 'Something went wrong. Please try again.';
          if (rootPath === 'login') message = 'Failed to Login.';
          if (rootPath === 'signup') message = 'Failed to sign up';

          return {
            message,
            locations: formattedError.locations,
            path: formattedError.path,
            extensions: { code },
          };
        }

        if (
          error instanceof Error &&
          /cannot read properties|undefined|typeerror|syntaxerror/i.test(
            error.message,
          )
        ) {
          return {
            message: 'Something went wrong. Please try again.',
            locations: formattedError.locations,
            path: formattedError.path,
            extensions: { code: code || 'INTERNAL_SERVER_ERROR' },
          };
        }

        if (code === 'FORBIDDEN') {
          return {
            message: 'You do not have permission to do that.',
            locations: formattedError.locations,
            path: formattedError.path,
            extensions: { code },
          };
        }

        if (code === 'UNAUTHENTICATED') {
          return {
            message: 'Please log in again.',
            locations: formattedError.locations,
            path: formattedError.path,
            extensions: { code },
          };
        }

        return {
          message: formattedError.message,
          locations: formattedError.locations,
          path: formattedError.path,
          extensions: code ? { code } : undefined,
        };
      },
    }),
    AdminModule,
    TeacherModule,
    SubjectModule,
    LessonModule,
    ClassModule,
    StudentModule,
    ParentModule,
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
    InvitationModule,
    SetupModule,
    AiModule,
    ContactModule,
    AuditModule,
    ChatModule,
    TermReportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppResolver,
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
  ],
})
export class AppModule {}
