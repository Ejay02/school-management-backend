import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { JwtService } from '@nestjs/jwt';
import { StudentResolver } from './student.resolver';
import { CloudinaryModule } from 'src/shared/cloudinary/cloudinary.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [CloudinaryModule, MailModule],
  providers: [StudentService, JwtService, StudentResolver],
  exports: [StudentService],
})
export class StudentModule {}
