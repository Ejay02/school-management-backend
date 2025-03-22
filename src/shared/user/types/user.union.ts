import { createUnionType } from '@nestjs/graphql';
import { Admin } from 'src/admin/types/admin.types';
import { Parent } from 'src/parent/types/parent.types';
import { Student } from 'src/student/types/student.types';
import { Teacher } from 'src/teacher/types/teacher.types';

export const UserUnion = createUnionType({
  name: 'UserUnion',
  types: () => [Admin, Student, Parent, Teacher] as const,
  resolveType(value) {
    if (value.role === 'ADMIN' || value.role === 'SUPER_ADMIN') return Admin;
    if (value.classId) return Student; // Only students have classId
    if (value.students) return Parent; // Only parents have students array
    return Teacher; // If nothing else matches, assume it's a Teacher
  },
});
