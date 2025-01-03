import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { DefaultClass } from './enum/class';

@Injectable()
export class ClassService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async getDefaultClasses(): Promise<DefaultClass[]> {
    return Object.values(DefaultClass);
  }

  // Public method to get the default classes
  public async setDefaultClasses(): Promise<void> {
    const defaultClasses = await this.getDefaultClasses();

    for (const className of defaultClasses) {
      // Create the class
      await this.prisma.class.create({
        data: {
          name: className, // Class name from DefaultClass enum
          capacity: 30, // Set default capacity, adjust as needed
        },
      });
    }
  }
}
