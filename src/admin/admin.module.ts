import { Module } from '@nestjs/common';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { JwtService } from '@nestjs/jwt';
import { CloudinaryModule } from '../shared/cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  providers: [AdminService, JwtService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
