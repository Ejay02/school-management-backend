import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
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

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
