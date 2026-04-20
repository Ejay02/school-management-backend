import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateSetupStateInput } from './input/update.setup-state.input';
import { SetupProgress, SetupStep } from './types/setup.types';

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSetupState() {
    return this.prisma.setupState.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  async getSetupState() {
    return this.ensureSetupState();
  }

  async updateSetupState(input: UpdateSetupStateInput) {
    await this.ensureSetupState();

    return this.prisma.setupState.update({
      where: { id: 'default' },
      data: {
        schoolName: input.schoolName,
        schoolEmail: input.schoolEmail,
        schoolPhone: input.schoolPhone,
        schoolAddress: input.schoolAddress,
        academicYearCurrent: input.academicYearCurrent,
        academicYearNext: input.academicYearNext,
        currentTerm: input.currentTerm,
      },
    });
  }

  async getSetupProgress(): Promise<SetupProgress> {
    const state = await this.ensureSetupState();

    const [
      classCount,
      subjectCount,
      lessonTeacherCount,
      supervisorCount,
      invitationCount,
    ] = await Promise.all([
      this.prisma.class.count(),
      this.prisma.subject.count(),
      this.prisma.lesson.count({
        where: {
          teacherId: {
            not: null,
          },
        },
      }),
      this.prisma.class.count({
        where: {
          supervisorId: {
            not: null,
          },
        },
      }),
      this.prisma.invitation.count(),
    ]);

    const schoolProfileComplete = Boolean(
      state.schoolName && state.schoolEmail && state.schoolPhone,
    );
    const academicSetupComplete = Boolean(
      state.academicYearCurrent && state.academicYearNext && state.currentTerm,
    );
    const teacherAssignmentsComplete =
      lessonTeacherCount > 0 || supervisorCount > 0;

    const steps: SetupStep[] = [
      {
        key: 'school_profile',
        label: 'School profile',
        completed: schoolProfileComplete,
        value: schoolProfileComplete
          ? 'School profile saved'
          : 'Add school name, email, and phone',
      },
      {
        key: 'academic_configuration',
        label: 'Academic configuration',
        completed: academicSetupComplete,
        value: academicSetupComplete
          ? `${state.academicYearCurrent}/${state.academicYearNext} - ${state.currentTerm}`
          : 'Set academic year and current term',
      },
      {
        key: 'classes',
        label: 'Classes',
        completed: classCount > 0,
        value:
          classCount > 0
            ? `${classCount} class records ready`
            : 'Create or confirm class records',
      },
      {
        key: 'subjects',
        label: 'Subjects',
        completed: subjectCount > 0,
        value:
          subjectCount > 0
            ? `${subjectCount} subjects configured`
            : 'Add subjects for classes',
      },
      {
        key: 'teacher_assignments',
        label: 'Teacher assignments',
        completed: teacherAssignmentsComplete,
        value: teacherAssignmentsComplete
          ? `${lessonTeacherCount} lesson assignments, ${supervisorCount} class supervisors`
          : 'Assign teachers to lessons or classes',
      },
      {
        key: 'invitations',
        label: 'Invitations',
        completed: invitationCount > 0,
        value:
          invitationCount > 0
            ? `${invitationCount} invites sent`
            : 'Invite teachers and parents',
      },
    ];

    const completedSteps = steps.filter((step) => step.completed).length;
    const totalSteps = steps.length;
    const normalizedState = {
      ...state,
      currentTerm: state.currentTerm as any,
    };

    return {
      state: normalizedState,
      steps,
      completedSteps,
      totalSteps,
      completionPercentage: Number(
        ((completedSteps / totalSteps) * 100).toFixed(2),
      ),
    };
  }
}
