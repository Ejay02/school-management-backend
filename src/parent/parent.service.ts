import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ParentService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async getAllParents() {
    try {
      return await this.prisma.parent.findMany({
        include: {
          students: {
            include: {
              class: true,
              grade: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch parents');
    }
  }

  async getParentById(parentId: string) {
    try {
      const parent = await this.prisma.parent.findUnique({
        where: { id: parentId },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException(`Parent with ID: ${parentId} not found`);
      }
      return parent;
    } catch (error) {
      throw new Error(`Failed to get parent: ${error.message}`);
    }
  }
}
