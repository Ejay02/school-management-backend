import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateSetupStateInput } from './input/update.setup-state.input';
import {
  OnboardingChecklist,
  OnboardingChecklistStep,
  SetupProgress,
  SetupStep,
} from './types/setup.types';
import { Roles } from 'src/shared/enum/role';
import { InviteStatus } from 'src/invitation/enum/inviteStatus';

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

    const normalizedSchoolDomain = (() => {
      const value =
        typeof input.schoolDomain === 'string' ? input.schoolDomain : '';
      const trimmed = value.trim().toLowerCase().replace(/^@/, '');
      return trimmed.length ? trimmed : null;
    })();

    return this.prisma.setupState.update({
      where: { id: 'default' },
      data: {
        schoolName: input.schoolName,
        schoolDomain: normalizedSchoolDomain,
        schoolEmail: input.schoolEmail,
        schoolPhone: input.schoolPhone,
        schoolAddress: input.schoolAddress,
        schoolLogo: input.schoolLogo,
        schoolContactName: input.schoolContactName,
        schoolTimezone: input.schoolTimezone,
        academicYearCurrent: input.academicYearCurrent,
        academicYearNext: input.academicYearNext,
        currentTerm: input.currentTerm,
      } as any,
    });
  }

  async getSetupProgress(): Promise<SetupProgress> {
    const state = (await this.ensureSetupState()) as any;

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
      state.schoolName &&
        state.schoolAddress &&
        state.schoolLogo &&
        state.schoolContactName &&
        state.schoolEmail &&
        state.schoolPhone &&
        state.schoolTimezone,
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
          : 'Add school name, address, logo, contact name, timezone, email, and phone',
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

  async getOnboardingChecklist(): Promise<OnboardingChecklist> {
    const state = (await this.ensureSetupState()) as any;

    const [
      classCount,
      subjectCount,
      subjectsWithTeachersCount,
      classesWithSubjects,
      inviteCounts,
    ] = await Promise.all([
      this.prisma.class.count(),
      this.prisma.subject.count(),
      this.prisma.subject.count({
        where: {
          teachers: {
            some: {},
          },
        },
      }),
      this.prisma.subject
        .groupBy({
          by: ['classId'],
        })
        .then((rows) => rows.length),
      this.prisma.invitation.groupBy({
        by: ['role', 'status'],
        _count: { _all: true },
      }),
    ]);

    const schoolProfileComplete = Boolean(
      state.schoolName &&
        state.schoolAddress &&
        state.schoolLogo &&
        state.schoolContactName &&
        state.schoolEmail &&
        state.schoolPhone &&
        state.schoolTimezone,
    );

    const getInviteStats = (role: Roles) => {
      const roleRows = inviteCounts.filter((row) => row.role === role);
      const pending =
        roleRows.find((row) => row.status === InviteStatus.PENDING)?._count
          ?._all ?? 0;
      const accepted =
        roleRows.find((row) => row.status === InviteStatus.ACCEPTED)?._count
          ?._all ?? 0;
      const expired =
        roleRows.find((row) => row.status === InviteStatus.EXPIRED)?._count
          ?._all ?? 0;
      const sent = pending + accepted + expired;

      return { sent, pending, accepted, expired };
    };

    const teacherInvites = getInviteStats(Roles.TEACHER);
    const parentInvites = getInviteStats(Roles.PARENT);

    const classesCreatedComplete = classCount > 0;
    const subjectsAssignedComplete =
      classCount > 0 &&
      classesWithSubjects === classCount &&
      subjectCount > 0 &&
      subjectsWithTeachersCount === subjectCount;

    const steps: OnboardingChecklistStep[] = [
      {
        key: 'school_profile_complete',
        label: 'School profile complete',
        complete: schoolProfileComplete,
        summary: schoolProfileComplete
          ? 'School profile saved'
          : 'Add school name, address, logo, contact name, timezone, email, and phone',
      },
      {
        key: 'classes_created',
        label: 'Classes created',
        complete: classesCreatedComplete,
        summary: classesCreatedComplete
          ? `${classCount} classes created`
          : 'Create your first class',
        meta: {
          count: classCount,
        },
      },
      {
        key: 'subjects_assigned',
        label: 'Subjects assigned',
        complete: subjectsAssignedComplete,
        summary:
          classCount === 0
            ? 'Create classes first'
            : subjectCount === 0
              ? 'Add subjects to your classes'
              : `${classesWithSubjects}/${classCount} classes have subjects (${subjectsWithTeachersCount}/${subjectCount} subjects have teachers)`,
        meta: {
          count: classesWithSubjects,
          total: classCount,
        },
      },
      {
        key: 'teachers_invited',
        label: 'Teachers invited',
        complete: teacherInvites.sent > 0,
        summary:
          teacherInvites.sent > 0
            ? `${teacherInvites.accepted}/${teacherInvites.sent} teachers accepted`
            : 'Invite at least one teacher',
        meta: {
          count: teacherInvites.sent,
          accepted: teacherInvites.accepted,
          pending: teacherInvites.pending,
          expired: teacherInvites.expired,
        },
      },
      {
        key: 'parents_invited',
        label: 'Parents invited',
        complete: parentInvites.sent > 0,
        summary:
          parentInvites.sent > 0
            ? `${parentInvites.accepted}/${parentInvites.sent} parents accepted`
            : 'Invite at least one parent',
        meta: {
          count: parentInvites.sent,
          accepted: parentInvites.accepted,
          pending: parentInvites.pending,
          expired: parentInvites.expired,
        },
      },
    ];

    const completedSteps = steps.filter((step) => step.complete).length;
    const totalSteps = steps.length;

    return {
      steps,
      completedSteps,
      totalSteps,
      completionPercentage: Number(
        ((completedSteps / totalSteps) * 100).toFixed(2),
      ),
    };
  }
}
