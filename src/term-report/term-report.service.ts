import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Term } from 'src/payment/enum/term';
import { Roles } from 'src/shared/enum/role';
import {
  StudentTermReport,
  TermReportAttendanceSummary,
  TermReportPosition,
  TermReportRemark,
  TermReportSubjectGrade,
} from './types/term-report.types';
import { UpsertTermReportRemarkInput } from './input/upsert.term-report-remark.input';

type ReportMetric = {
  subjectGrades: TermReportSubjectGrade[];
  overallAverage: number | null;
};

type ReportWeights = {
  examWeight: number;
  assessmentWeight: number;
  attendanceWeight: number;
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
      {
        value: examAverage,
        weight: normalizedWeights.examWeight,
      },
      {
        value: assignmentAverage,
        weight: normalizedWeights.assessmentWeight,
      },
      {
        value: attendanceRate,
        weight: normalizedWeights.attendanceWeight,
      },
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

      if (result?.examId) {
        entry.examScores.push(score);
      } else if (result?.assignmentId) {
        entry.assignmentScores.push(score);
      }
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
        overallAverage === null
          ? null
          : this.roundToTwoDecimals(overallAverage),
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

    classStudentIds.forEach((studentId) => {
      groupedRecords.set(studentId, []);
    });

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

  async getStudentTermReport(
    studentId: string,
    academicPeriod: string,
    term: Term,
  ): Promise<StudentTermReport> {
    const parsedPeriod = this.parseAcademicPeriod(academicPeriod);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            students: { select: { id: true } },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const classStudentIds = student.class.students.map((entry) => entry.id);
    const { startDate, endDate } = this.resolveTermDateRange(
      parsedPeriod.normalized,
      term,
    );

    const [setupState, classResults, classAttendanceRecords, remark] =
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
        this.prisma.result.findMany({
          where: {
            student: { classId: student.classId },
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
            student: { classId: student.classId },
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: { studentId: true, present: true },
        }),
        this.prisma.termReportRemark.findUnique({
          where: {
            studentId_academicPeriod_term: {
              studentId,
              academicPeriod: parsedPeriod.normalized,
              term,
            },
          },
        }),
      ]);

    const attendanceByStudentId = this.buildAttendanceMap(
      classStudentIds,
      classAttendanceRecords,
    );
    const reportWeights: ReportWeights = {
      examWeight: setupState.reportExamWeight ?? 60,
      assessmentWeight: setupState.reportAssessmentWeight ?? 30,
      attendanceWeight: setupState.reportAttendanceWeight ?? 10,
    };

    const { metricsByStudent, rankingMap } = this.buildRanking(
      classStudentIds,
      classResults,
      attendanceByStudentId,
      reportWeights,
      classStudentIds.length,
    );
    const metric = metricsByStudent.get(studentId) || {
      subjectGrades: [],
      overallAverage: null,
    };

    return {
      studentId: student.id,
      studentName: [student.name, student.surname].filter(Boolean).join(' '),
      studentCode: student.studentId,
      classId: student.class.id,
      className: student.class.name,
      academicPeriod: parsedPeriod.normalized,
      term,
      schoolName: setupState.schoolName,
      schoolLogo: setupState.schoolLogo,
      schoolAddress: setupState.schoolAddress,
      overallAverage: metric.overallAverage,
      ranking: rankingMap.get(studentId) || {
        position: null,
        totalStudents: classStudentIds.length,
      },
      attendance:
        attendanceByStudentId.get(studentId) || this.buildAttendanceSummary([]),
      subjectGrades: metric.subjectGrades,
      remark: (remark as TermReportRemark | null) || null,
    };
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
      select: { id: true, classId: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return (await this.prisma.termReportRemark.upsert({
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
    })) as unknown as TermReportRemark;
  }
}
