import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { Term } from 'src/payment/enum/term';
import { Roles } from 'src/shared/enum/role';
import { ManageTermReportInput } from './input/manage.term-report.input';
import { UpsertTermReportRemarkInput } from './input/upsert.term-report-remark.input';
import { TermReportStatus } from './enum/term-report-status';
import {
  StudentTermReport,
  StudentTermReportSummary,
  TermReportAttendanceSummary,
  TermReportPosition,
  TermReportReadiness,
  TermReportRemark,
  TermReportSubjectGrade,
} from './types/term-report.types';

type ReportMetric = {
  subjectGrades: TermReportSubjectGrade[];
  overallAverage: number | null;
};

type ReportWeights = {
  examWeight: number;
  assessmentWeight: number;
  attendanceWeight: number;
};

type StudentRecord = {
  id: string;
  name: string;
  surname: string;
  studentId?: string | null;
};

type StoredTermReportRecord = {
  id: string;
  studentId: string;
  classId: string;
  academicPeriod: string;
  term: Term;
  remark: string;
  authorId?: string | null;
  authorRole?: Roles | null;
  status: TermReportStatus;
  publishedAt?: Date | null;
  publishedById?: string | null;
  publishedByRole?: Roles | null;
  publishedSnapshot?: any;
  createdAt: Date;
  updatedAt: Date;
};

type ClassReportContext = {
  classId: string;
  className: string;
  academicPeriod: string;
  term: Term;
  students: StudentRecord[];
  schoolName?: string | null;
  schoolLogo?: string | null;
  schoolAddress?: string | null;
  weights: ReportWeights;
  attendanceByStudentId: Map<string, TermReportAttendanceSummary>;
  metricsByStudent: Map<string, ReportMetric>;
  rankingMap: Map<string, TermReportPosition>;
  recordsByStudentId: Map<string, StoredTermReportRecord>;
};

@Injectable()
export class TermReportService {
  constructor(private readonly prisma: PrismaService) {}

  private roundToTwoDecimals(value: number) {
    return Math.round(value * 100) / 100;
  }

  private parseAcademicPeriod(academicPeriod: string) {
    const value = String(academicPeriod || '').trim();
    const match = value.match(/^(\d{4})\s*\/\s*(\d{4})$/);
    if (!match) {
      throw new BadRequestException(
        'Academic period must use the format YYYY/YYYY.',
      );
    }

    const firstYear = Number.parseInt(match[1], 10);
    const secondYear = Number.parseInt(match[2], 10);
    if (secondYear !== firstYear + 1) {
      throw new BadRequestException('Academic period is invalid.');
    }

    return { firstYear, secondYear, normalized: `${firstYear}/${secondYear}` };
  }

  private resolveTermDateRange(academicPeriod: string, term: Term) {
    const { firstYear, secondYear } = this.parseAcademicPeriod(academicPeriod);

    if (term === Term.FIRST) {
      return {
        startDate: new Date(firstYear, 8, 1),
        endDate: new Date(firstYear, 11, 31, 23, 59, 59, 999),
      };
    }

    if (term === Term.SECOND) {
      return {
        startDate: new Date(secondYear, 0, 1),
        endDate: new Date(secondYear, 2, 31, 23, 59, 59, 999),
      };
    }

    return {
      startDate: new Date(secondYear, 3, 1),
      endDate: new Date(secondYear, 6, 31, 23, 59, 59, 999),
    };
  }

  private average(values: number[]) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private normalizeWeights(weights: ReportWeights) {
    const total =
      weights.examWeight + weights.assessmentWeight + weights.attendanceWeight;

    if (total <= 0) {
      return {
        examWeight: 0,
        assessmentWeight: 0,
        attendanceWeight: 0,
      };
    }

    return {
      examWeight: weights.examWeight / total,
      assessmentWeight: weights.assessmentWeight / total,
      attendanceWeight: weights.attendanceWeight / total,
    };
  }

  private buildWeightedScore(
    examAverage: number | null,
    assignmentAverage: number | null,
    attendanceRate: number | null,
    weights: ReportWeights,
  ) {
    const normalizedWeights = this.normalizeWeights(weights);
    const components = [
      { value: examAverage, weight: normalizedWeights.examWeight },
      {
        value: assignmentAverage,
        weight: normalizedWeights.assessmentWeight,
      },
      { value: attendanceRate, weight: normalizedWeights.attendanceWeight },
    ].filter(
      (component): component is { value: number; weight: number } =>
        typeof component.value === 'number' && component.weight > 0,
    );

    if (!components.length) return null;

    const totalWeight = components.reduce(
      (sum, component) => sum + component.weight,
      0,
    );
    if (!totalWeight) return null;

    const weightedValue = components.reduce(
      (sum, component) => sum + component.value * component.weight,
      0,
    );

    return weightedValue / totalWeight;
  }

  private buildMetricFromResults(
    results: Array<any>,
    attendanceRate: number | null,
    weights: ReportWeights,
  ): ReportMetric {
    const subjectMap = new Map<
      string,
      { name: string; examScores: number[]; assignmentScores: number[] }
    >();

    results.forEach((result) => {
      const subjectName =
        result?.exam?.subject?.name ||
        result?.assignment?.subject?.name ||
        null;
      if (!subjectName) return;

      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, {
          name: subjectName,
          examScores: [],
          assignmentScores: [],
        });
      }

      const entry = subjectMap.get(subjectName);
      if (!entry) return;

      const score = Number(result?.score);
      if (!Number.isFinite(score)) return;

      if (result?.examId) entry.examScores.push(score);
      if (result?.assignmentId) entry.assignmentScores.push(score);
    });

    const subjectGrades = Array.from(subjectMap.values())
      .map((entry) => {
        const examAverage = this.average(entry.examScores);
        const assignmentAverage = this.average(entry.assignmentScores);
        const finalScore = this.buildWeightedScore(
          examAverage,
          assignmentAverage,
          attendanceRate,
          weights,
        );

        return {
          name: entry.name,
          examAverage:
            examAverage === null ? null : this.roundToTwoDecimals(examAverage),
          assignmentAverage:
            assignmentAverage === null
              ? null
              : this.roundToTwoDecimals(assignmentAverage),
          finalScore:
            finalScore === null ? null : this.roundToTwoDecimals(finalScore),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    const overallScores = subjectGrades
      .map((subject) => subject.finalScore)
      .filter((score): score is number => typeof score === 'number');

    const overallAverage = this.average(overallScores);

    return {
      subjectGrades,
      overallAverage:
        overallAverage === null ? null : this.roundToTwoDecimals(overallAverage),
    };
  }

  private buildRanking(
    classStudentIds: string[],
    classResults: Array<any>,
    attendanceByStudentId: Map<string, TermReportAttendanceSummary>,
    weights: ReportWeights,
    totalStudents: number,
  ) {
    const metricsByStudent = new Map<string, ReportMetric>();

    classStudentIds.forEach((studentId) => {
      const studentResults = classResults.filter(
        (result) => result.studentId === studentId,
      );
      metricsByStudent.set(
        studentId,
        this.buildMetricFromResults(
          studentResults,
          attendanceByStudentId.get(studentId)?.attendanceRate ?? null,
          weights,
        ),
      );
    });

    const rankedStudents = Array.from(metricsByStudent.entries())
      .map(([studentId, metric]) => ({
        studentId,
        score: metric.overallAverage,
      }))
      .filter((entry): entry is { studentId: string; score: number } => {
        return typeof entry.score === 'number';
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.studentId.localeCompare(right.studentId);
      });

    const rankingMap = new Map<string, TermReportPosition>();
    let currentPosition = 0;
    let previousScore: number | null = null;

    rankedStudents.forEach((entry, index) => {
      if (previousScore === null || entry.score !== previousScore) {
        currentPosition = index + 1;
        previousScore = entry.score;
      }

      rankingMap.set(entry.studentId, {
        position: currentPosition,
        totalStudents,
      });
    });

    classStudentIds.forEach((studentId) => {
      if (!rankingMap.has(studentId)) {
        rankingMap.set(studentId, {
          position: null,
          totalStudents,
        });
      }
    });

    return { metricsByStudent, rankingMap };
  }

  private buildAttendanceSummary(
    records: Array<{ present: boolean }>,
  ): TermReportAttendanceSummary {
    const totalClasses = records.length;
    const presentClasses = records.filter((record) => record.present).length;
    const absentClasses = totalClasses - presentClasses;
    const attendanceRate = totalClasses
      ? this.roundToTwoDecimals((presentClasses / totalClasses) * 100)
      : 0;

    return {
      presentClasses,
      absentClasses,
      totalClasses,
      attendanceRate,
    };
  }

  private buildAttendanceMap(
    classStudentIds: string[],
    records: Array<{ studentId: string; present: boolean }>,
  ) {
    const groupedRecords = new Map<string, Array<{ present: boolean }>>();

    classStudentIds.forEach((studentId) => groupedRecords.set(studentId, []));

    records.forEach((record) => {
      if (!groupedRecords.has(record.studentId)) {
        groupedRecords.set(record.studentId, []);
      }
      groupedRecords.get(record.studentId)?.push({ present: record.present });
    });

    const summaryMap = new Map<string, TermReportAttendanceSummary>();
    groupedRecords.forEach((studentRecords, studentId) => {
      summaryMap.set(studentId, this.buildAttendanceSummary(studentRecords));
    });

    return summaryMap;
  }

  private buildReadiness(
    metric: ReportMetric,
    attendance: TermReportAttendanceSummary,
    remark: string,
    weights: ReportWeights,
  ): TermReportReadiness {
    const issues: string[] = [];
    const hasExamScores = metric.subjectGrades.some(
      (subject) => typeof subject.examAverage === 'number',
    );
    const hasAssessmentScores = metric.subjectGrades.some(
      (subject) => typeof subject.assignmentAverage === 'number',
    );

    if (!metric.subjectGrades.length) {
      issues.push('No subject grades available.');
    }
    if (weights.examWeight > 0 && !hasExamScores) {
      issues.push('Missing exam scores.');
    }
    if (weights.assessmentWeight > 0 && !hasAssessmentScores) {
      issues.push('Missing assessment scores.');
    }
    if (weights.attendanceWeight > 0 && attendance.totalClasses === 0) {
      issues.push('Missing attendance records.');
    }
    if (metric.overallAverage === null) {
      issues.push('Overall average cannot be computed yet.');
    }
    if (!String(remark || '').trim()) {
      issues.push('Missing official term remark.');
    }

    return {
      ready: issues.length === 0,
      issues,
    };
  }

  private toStoredRemark(record: any): StoredTermReportRecord {
    return record as StoredTermReportRecord;
  }

  private toGraphqlRemark(
    record: StoredTermReportRecord | null | undefined,
  ): TermReportRemark | null {
    if (!record) return null;
    return {
      id: record.id,
      studentId: record.studentId,
      classId: record.classId,
      academicPeriod: record.academicPeriod,
      term: record.term,
      remark: record.remark,
      authorId: record.authorId ?? null,
      authorRole: record.authorRole ?? null,
      status: record.status,
      publishedAt: record.publishedAt ?? null,
      publishedById: record.publishedById ?? null,
      publishedByRole: record.publishedByRole ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private buildStudentName(student: StudentRecord) {
    return [student.name, student.surname].filter(Boolean).join(' ');
  }

  private createDraftReport(
    student: StudentRecord,
    context: ClassReportContext,
  ): StudentTermReport {
    const record = context.recordsByStudentId.get(student.id) || null;
    const metric = context.metricsByStudent.get(student.id) || {
      subjectGrades: [],
      overallAverage: null,
    };
    const attendance =
      context.attendanceByStudentId.get(student.id) || this.buildAttendanceSummary([]);
    const readiness = this.buildReadiness(
      metric,
      attendance,
      record?.remark || '',
      context.weights,
    );

    return {
      studentId: student.id,
      studentName: this.buildStudentName(student),
      studentCode: student.studentId ?? null,
      classId: context.classId,
      className: context.className,
      academicPeriod: context.academicPeriod,
      term: context.term,
      schoolName: context.schoolName ?? null,
      schoolLogo: context.schoolLogo ?? null,
      schoolAddress: context.schoolAddress ?? null,
      overallAverage: metric.overallAverage,
      status: record?.status || TermReportStatus.DRAFT,
      publishedAt: record?.publishedAt ?? null,
      publishedById: record?.publishedById ?? null,
      publishedByRole: record?.publishedByRole ?? null,
      ranking: context.rankingMap.get(student.id) || {
        position: null,
        totalStudents: context.students.length,
      },
      attendance,
      readiness,
      subjectGrades: metric.subjectGrades,
      remark: this.toGraphqlRemark(record),
    };
  }

  private createPublishedReport(
    student: StudentRecord,
    context: ClassReportContext,
    record: StoredTermReportRecord,
  ): StudentTermReport {
    const snapshot = (record.publishedSnapshot || {}) as any;
    return {
      studentId: snapshot.studentId || student.id,
      studentName: snapshot.studentName || this.buildStudentName(student),
      studentCode:
        snapshot.studentCode !== undefined
          ? snapshot.studentCode
          : (student.studentId ?? null),
      classId: snapshot.classId || context.classId,
      className: snapshot.className || context.className,
      academicPeriod: snapshot.academicPeriod || context.academicPeriod,
      term: snapshot.term || context.term,
      schoolName: snapshot.schoolName ?? context.schoolName ?? null,
      schoolLogo: snapshot.schoolLogo ?? context.schoolLogo ?? null,
      schoolAddress: snapshot.schoolAddress ?? context.schoolAddress ?? null,
      overallAverage:
        typeof snapshot.overallAverage === 'number'
          ? snapshot.overallAverage
          : null,
      status: TermReportStatus.PUBLISHED,
      publishedAt: record.publishedAt ?? null,
      publishedById: record.publishedById ?? null,
      publishedByRole: record.publishedByRole ?? null,
      ranking: snapshot.ranking || {
        position: null,
        totalStudents: context.students.length,
      },
      attendance:
        snapshot.attendance ||
        context.attendanceByStudentId.get(student.id) ||
        this.buildAttendanceSummary([]),
      readiness: { ready: true, issues: [] },
      subjectGrades: Array.isArray(snapshot.subjectGrades)
        ? snapshot.subjectGrades
        : [],
      remark: this.toGraphqlRemark(record),
    };
  }

  private createSnapshot(report: StudentTermReport) {
    return JSON.parse(
      JSON.stringify({
        studentId: report.studentId,
        studentName: report.studentName,
        studentCode: report.studentCode ?? null,
        classId: report.classId,
        className: report.className,
        academicPeriod: report.academicPeriod,
        term: report.term,
        schoolName: report.schoolName ?? null,
        schoolLogo: report.schoolLogo ?? null,
        schoolAddress: report.schoolAddress ?? null,
        overallAverage: report.overallAverage ?? null,
        ranking: report.ranking,
        attendance: report.attendance,
        subjectGrades: report.subjectGrades,
        readiness: report.readiness,
      }),
    ) as Prisma.InputJsonValue;
  }

  private async buildClassReportContext(
    classId: string,
    academicPeriod: string,
    term: Term,
  ): Promise<ClassReportContext> {
    const parsedPeriod = this.parseAcademicPeriod(academicPeriod);
    const { startDate, endDate } = this.resolveTermDateRange(
      parsedPeriod.normalized,
      term,
    );

    const [setupState, classRecord, classResults, classAttendanceRecords, records] =
      await Promise.all([
        this.prisma.setupState.upsert({
          where: { id: 'default' },
          update: {},
          create: { id: 'default' },
          select: {
            schoolName: true,
            schoolLogo: true,
            schoolAddress: true,
            reportExamWeight: true,
            reportAssessmentWeight: true,
            reportAttendanceWeight: true,
          },
        }),
        this.prisma.class.findUnique({
          where: { id: classId },
          select: {
            id: true,
            name: true,
            students: {
              select: {
                id: true,
                name: true,
                surname: true,
                studentId: true,
              },
            },
          },
        }),
        this.prisma.result.findMany({
          where: {
            student: { classId },
            academicPeriod: parsedPeriod.normalized,
            term,
            OR: [{ examId: { not: null } }, { assignmentId: { not: null } }],
          },
          include: {
            student: { select: { id: true } },
            exam: {
              include: { subject: { select: { id: true, name: true } } },
            },
            assignment: {
              include: { subject: { select: { id: true, name: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.attendance.findMany({
          where: {
            classId,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: { studentId: true, present: true },
        }),
        this.prisma.termReportRemark.findMany({
          where: {
            classId,
            academicPeriod: parsedPeriod.normalized,
            term,
          },
        }),
      ]);

    if (!classRecord) {
      throw new NotFoundException('Class not found');
    }

    const students = classRecord.students as StudentRecord[];
    const classStudentIds = students.map((entry) => entry.id);
    const attendanceByStudentId = this.buildAttendanceMap(
      classStudentIds,
      classAttendanceRecords,
    );
    const weights: ReportWeights = {
      examWeight: setupState.reportExamWeight ?? 60,
      assessmentWeight: setupState.reportAssessmentWeight ?? 30,
      attendanceWeight: setupState.reportAttendanceWeight ?? 10,
    };
    const { metricsByStudent, rankingMap } = this.buildRanking(
      classStudentIds,
      classResults,
      attendanceByStudentId,
      weights,
      classStudentIds.length,
    );
    const recordsByStudentId = new Map<string, StoredTermReportRecord>();
    records.forEach((record) => {
      recordsByStudentId.set(record.studentId, this.toStoredRemark(record));
    });

    return {
      classId: classRecord.id,
      className: classRecord.name,
      academicPeriod: parsedPeriod.normalized,
      term,
      students,
      schoolName: setupState.schoolName,
      schoolLogo: setupState.schoolLogo,
      schoolAddress: setupState.schoolAddress,
      weights,
      attendanceByStudentId,
      metricsByStudent,
      rankingMap,
      recordsByStudentId,
    };
  }

  private getStudentFromContext(context: ClassReportContext, studentId: string) {
    const student = context.students.find((entry) => entry.id === studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  async getStudentTermReport(
    studentId: string,
    academicPeriod: string,
    term: Term,
  ): Promise<StudentTermReport> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        classId: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const context = await this.buildClassReportContext(
      student.classId,
      academicPeriod,
      term,
    );
    const contextStudent = this.getStudentFromContext(context, studentId);
    const record = context.recordsByStudentId.get(studentId) || null;

    if (
      record?.status === TermReportStatus.PUBLISHED &&
      record.publishedSnapshot
    ) {
      return this.createPublishedReport(contextStudent, context, record);
    }

    return this.createDraftReport(contextStudent, context);
  }

  async getClassTermReportSummaries(
    classId: string,
    academicPeriod: string,
    term: Term,
  ): Promise<StudentTermReportSummary[]> {
    const context = await this.buildClassReportContext(classId, academicPeriod, term);

    return context.students.map((student) => {
      const record = context.recordsByStudentId.get(student.id) || null;

      if (
        record?.status === TermReportStatus.PUBLISHED &&
        record.publishedSnapshot
      ) {
        const snapshot = record.publishedSnapshot as any;
        return {
          studentId: student.id,
          studentName: this.buildStudentName(student),
          overallAverage:
            typeof snapshot?.overallAverage === 'number'
              ? snapshot.overallAverage
              : null,
          attendanceRate:
            typeof snapshot?.attendance?.attendanceRate === 'number'
              ? snapshot.attendance.attendanceRate
              : 0,
          position:
            typeof snapshot?.ranking?.position === 'number'
              ? snapshot.ranking.position
              : null,
          totalStudents:
            Number(snapshot?.ranking?.totalStudents) || context.students.length,
          status: TermReportStatus.PUBLISHED,
          readiness: { ready: true, issues: [] },
        };
      }

      const metric = context.metricsByStudent.get(student.id) || {
        subjectGrades: [],
        overallAverage: null,
      };
      const attendance =
        context.attendanceByStudentId.get(student.id) ||
        this.buildAttendanceSummary([]);
      const readiness = this.buildReadiness(
        metric,
        attendance,
        record?.remark || '',
        context.weights,
      );
      const ranking = context.rankingMap.get(student.id) || {
        position: null,
        totalStudents: context.students.length,
      };

      return {
        studentId: student.id,
        studentName: this.buildStudentName(student),
        overallAverage: metric.overallAverage,
        attendanceRate: attendance.attendanceRate,
        position: ranking.position,
        totalStudents: ranking.totalStudents,
        status: record?.status || TermReportStatus.DRAFT,
        readiness,
      };
    });
  }

  async upsertTermReportRemark(
    input: UpsertTermReportRemarkInput,
    actorId: string,
    actorRole: Roles,
  ): Promise<TermReportRemark> {
    const parsedPeriod = this.parseAcademicPeriod(input.academicPeriod);
    const remark = String(input.remark || '').trim();

    if (remark.length < 2) {
      throw new BadRequestException('Remark is too short.');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, classId: true, class: { select: { supervisorId: true } } },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (
      actorRole === Roles.TEACHER &&
      student.class?.supervisorId !== actorId
    ) {
      throw new BadRequestException(
        'Only the class supervisor can save this report remark.',
      );
    }

    const existing = await this.prisma.termReportRemark.findUnique({
      where: {
        studentId_academicPeriod_term: {
          studentId: student.id,
          academicPeriod: parsedPeriod.normalized,
          term: input.term,
        },
      },
    });

    if (existing?.status === TermReportStatus.PUBLISHED) {
      throw new BadRequestException(
        'Published reports are locked. Revert to draft before editing the remark.',
      );
    }

    const saved = await this.prisma.termReportRemark.upsert({
      where: {
        studentId_academicPeriod_term: {
          studentId: student.id,
          academicPeriod: parsedPeriod.normalized,
          term: input.term,
        },
      },
      update: {
        remark,
        classId: student.classId,
        authorId: actorId,
        authorRole: actorRole as any,
      },
      create: {
        studentId: student.id,
        classId: student.classId,
        academicPeriod: parsedPeriod.normalized,
        term: input.term,
        remark,
        authorId: actorId,
        authorRole: actorRole as any,
      },
    });

    return this.toGraphqlRemark(this.toStoredRemark(saved)) as TermReportRemark;
  }

  async publishStudentTermReport(
    input: ManageTermReportInput,
    actorId: string,
    actorRole: Roles,
  ): Promise<StudentTermReport> {
    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, classId: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const context = await this.buildClassReportContext(
      student.classId,
      input.academicPeriod,
      input.term,
    );
    const contextStudent = this.getStudentFromContext(context, input.studentId);
    const draftReport = this.createDraftReport(contextStudent, context);

    if (!draftReport.readiness.ready) {
      throw new BadRequestException(
        `Report is not ready to publish: ${draftReport.readiness.issues.join(' ')}`,
      );
    }

    await this.prisma.termReportRemark.upsert({
      where: {
        studentId_academicPeriod_term: {
          studentId: input.studentId,
          academicPeriod: context.academicPeriod,
          term: input.term,
        },
      },
      update: {
        classId: context.classId,
        status: TermReportStatus.PUBLISHED as any,
        publishedAt: new Date(),
        publishedById: actorId,
        publishedByRole: actorRole as any,
        publishedSnapshot: this.createSnapshot({
          ...draftReport,
          status: TermReportStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedById: actorId,
          publishedByRole: actorRole,
        }),
      },
      create: {
        studentId: input.studentId,
        classId: context.classId,
        academicPeriod: context.academicPeriod,
        term: input.term,
        remark: draftReport.remark?.remark || '',
        authorId: actorId,
        authorRole: actorRole as any,
        status: TermReportStatus.PUBLISHED as any,
        publishedAt: new Date(),
        publishedById: actorId,
        publishedByRole: actorRole as any,
        publishedSnapshot: this.createSnapshot({
          ...draftReport,
          status: TermReportStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedById: actorId,
          publishedByRole: actorRole,
        }),
      },
    });

    return this.getStudentTermReport(
      input.studentId,
      context.academicPeriod,
      input.term,
    );
  }

  async revertStudentTermReportToDraft(
    input: ManageTermReportInput,
    actorId: string,
    actorRole: Roles,
  ): Promise<StudentTermReport> {
    const parsedPeriod = this.parseAcademicPeriod(input.academicPeriod);
    const existing = await this.prisma.termReportRemark.findUnique({
      where: {
        studentId_academicPeriod_term: {
          studentId: input.studentId,
          academicPeriod: parsedPeriod.normalized,
          term: input.term,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('No saved report exists for this student.');
    }

    await this.prisma.termReportRemark.update({
      where: { id: existing.id },
      data: {
        status: TermReportStatus.DRAFT as any,
        publishedAt: null,
        publishedById: null,
        publishedByRole: null,
        publishedSnapshot: null,
        authorId: actorId,
        authorRole: actorRole as any,
      },
    });

    return this.getStudentTermReport(
      input.studentId,
      parsedPeriod.normalized,
      input.term,
    );
  }
}
