import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQuestionInput } from './input/create-question.input';

@Injectable()
export class QuestionService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestion(
    questionData: CreateQuestionInput,
    examId?: string,
    assignmentId?: string,
  ) {
    return this.prisma.question.create({
      data: {
        type: questionData.questionType,
        content: questionData.content,
        options: questionData.options,
        correctAnswer: questionData.correctAnswer,
        points: questionData.points,
        exam: examId ? { connect: { id: examId } } : undefined,
        assignment: assignmentId
          ? { connect: { id: assignmentId } }
          : undefined,
      },
    });
  }

  async getQuestionsByExam(examId: string) {
    return this.prisma.question.findMany({
      where: { examId },
    });
  }

  async getQuestionsByAssignment(assignmentId: string) {
    return this.prisma.question.findMany({
      where: { assignmentId },
    });
  }
}
