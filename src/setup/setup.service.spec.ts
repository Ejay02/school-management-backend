import { SetupService } from './setup.service';

describe('SetupService', () => {
  const createPrismaMock = () =>
    ({
      setupState: { upsert: jest.fn() },
      class: { count: jest.fn() },
      subject: { count: jest.fn(), groupBy: jest.fn() },
      invitation: { groupBy: jest.fn() },
    }) as any;

  describe('getOnboardingChecklist', () => {
    it('derives an incomplete checklist when there is no setup data', async () => {
      const prisma = createPrismaMock();
      prisma.setupState.upsert.mockResolvedValue({
        id: 'default',
        schoolName: null,
        schoolEmail: null,
        schoolPhone: null,
      });
      prisma.class.count.mockResolvedValue(0);
      prisma.subject.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.subject.groupBy.mockResolvedValue([]);
      prisma.invitation.groupBy.mockResolvedValue([]);

      const service = new SetupService(prisma);
      const result = await service.getOnboardingChecklist();

      expect(result.totalSteps).toBe(5);
      expect(result.completedSteps).toBe(0);
      expect(result.steps.map((s) => s.complete)).toEqual([
        false,
        false,
        false,
        false,
        false,
      ]);
    });

    it('marks subjects assigned only when every class has subjects and every subject has a teacher', async () => {
      const prisma = createPrismaMock();
      prisma.setupState.upsert.mockResolvedValue({
        id: 'default',
        schoolName: 'Test School',
        schoolEmail: 'hello@test.com',
        schoolPhone: '123',
      });
      prisma.class.count.mockResolvedValue(2);
      prisma.subject.count.mockResolvedValueOnce(4).mockResolvedValueOnce(4);
      prisma.subject.groupBy.mockResolvedValue([
        { classId: 'c1' },
        { classId: 'c2' },
      ]);
      prisma.invitation.groupBy.mockResolvedValue([
        { role: 'TEACHER', status: 'PENDING', _count: { _all: 1 } },
      ]);

      const service = new SetupService(prisma);
      const result = await service.getOnboardingChecklist();

      const subjectsStep = result.steps.find(
        (s) => s.key === 'subjects_assigned',
      );
      expect(subjectsStep?.complete).toBe(true);
      expect(subjectsStep?.meta).toEqual({ count: 2, total: 2 });
    });

    it('does not count revoked invitations as invited', async () => {
      const prisma = createPrismaMock();
      prisma.setupState.upsert.mockResolvedValue({
        id: 'default',
        schoolName: 'Test School',
        schoolEmail: 'hello@test.com',
        schoolPhone: '123',
      });
      prisma.class.count.mockResolvedValue(1);
      prisma.subject.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      prisma.subject.groupBy.mockResolvedValue([{ classId: 'c1' }]);
      prisma.invitation.groupBy.mockResolvedValue([
        { role: 'TEACHER', status: 'REVOKED', _count: { _all: 10 } },
        { role: 'PARENT', status: 'REVOKED', _count: { _all: 7 } },
      ]);

      const service = new SetupService(prisma);
      const result = await service.getOnboardingChecklist();

      const teachersStep = result.steps.find(
        (s) => s.key === 'teachers_invited',
      );
      const parentsStep = result.steps.find((s) => s.key === 'parents_invited');

      expect(teachersStep?.complete).toBe(false);
      expect(teachersStep?.meta?.count).toBe(0);
      expect(parentsStep?.complete).toBe(false);
      expect(parentsStep?.meta?.count).toBe(0);
    });
  });
});
