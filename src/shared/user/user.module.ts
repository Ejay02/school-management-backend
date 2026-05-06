import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import {
  AdminStatusResolver,
  ParentStatusResolver,
  StudentStatusResolver,
  TeacherStatusResolver,
  UserResolver,
} from './user.resolver';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  providers: [
    UserService,
    UserResolver,
    AdminStatusResolver,
    TeacherStatusResolver,
    StudentStatusResolver,
    ParentStatusResolver,
    PrismaService,
    JwtService,
  ],
  exports: [UserService],
})
export class UserModule {}
