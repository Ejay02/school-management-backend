import { Module } from '@nestjs/common';
import { ParentService } from './parent.service';
import { JwtService } from '@nestjs/jwt';
import { ParentResolver } from './parent.resolver';
import { CloudinaryModule } from 'src/shared/cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  providers: [ParentService, JwtService, ParentResolver],
  exports: [ParentService],
})
export class ParentModule {}
