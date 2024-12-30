import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TeacherService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}
}
