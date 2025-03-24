import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthResolver } from './auth.resolver';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../jwt/jwt.strategy';

import { SecurityModule } from '../security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClassModule } from '../../class/class.module';
import { SubjectModule } from '../../subject/subject.module';
import { LessonModule } from '../../lesson/lesson.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt', property: 'user' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: {
          expiresIn: '48h',
        },
      }),
    }),
    PrismaModule,
    SecurityModule,
    ClassModule,
    SubjectModule,
    LessonModule,
  ],

  providers: [
    AuthService,
    AuthResolver,
    JwtStrategy,
    // PrismaService,
    // ClassService,
    // LessonService,
    // SubjectService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
