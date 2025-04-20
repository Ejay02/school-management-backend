import { Module } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { TeacherResolver } from './teacher.resolver';
import { JwtService } from '@nestjs/jwt';
import { CloudinaryModule } from 'src/shared/cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  providers: [TeacherService, JwtService, TeacherResolver],
  exports: [TeacherService],
})
export class TeacherModule {}
