import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { JwtService } from '@nestjs/jwt';
import { StudentResolver } from './student.resolver';
import { CloudinaryModule } from 'src/shared/cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  providers: [StudentService, JwtService, StudentResolver],
  exports: [StudentService],
})
export class StudentModule {}
