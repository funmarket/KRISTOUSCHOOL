import type { ClassStudentRosterItem, SchoolClassSummary } from '../../types.ts';

export function filterSchoolClasses(
  classes: readonly SchoolClassSummary[],
  query: string,
  levelFilter: string,
  yearFilter: string,
): SchoolClassSummary[] {
  const q = query.trim().toLowerCase();
  return classes.filter((cls) => {
    if (levelFilter !== 'ALL' && cls.level !== levelFilter && cls.levelCode !== levelFilter) return false;
    if (yearFilter !== 'ALL' && cls.academicYear !== yearFilter) return false;
    if (!q) return true;
    return (
      cls.name.toLowerCase().includes(q) ||
      cls.level.toLowerCase().includes(q) ||
      (cls.homeroomTeacherName?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function filterClassRoster(
  students: readonly ClassStudentRosterItem[],
  query: string,
): ClassStudentRosterItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...students];
  return students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      (s.primaryGuardianName?.toLowerCase().includes(q) ?? false),
  );
}

