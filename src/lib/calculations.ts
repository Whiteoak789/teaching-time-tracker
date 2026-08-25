import {
  addDays,
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfWeek,
} from "date-fns";
import type { Category, DailyTotal, ProgressSummary, Semester, TimeEntry, WeeklyTotal } from "@/types";

export function calculateDailyCredit(entries: TimeEntry[], semester: Semester): number {
  const overrides = entries
    .map((entry) => entry.day_credit_override)
    .filter((value): value is number => value !== null);
  if (overrides.length) return Math.max(...overrides);

  const hours = entries
    .filter((entry) => entry.counts_clinical)
    .reduce((total, entry) => total + entry.duration_minutes / 60, 0);
  if (hours >= semester.full_day_threshold) return 1;
  if (hours >= semester.half_day_threshold) return 0.5;
  if (semester.partial_hours_accumulate && hours > 0) {
    return Math.min(1, hours / semester.full_day_threshold);
  }
  return 0;
}

function verificationState(entries: TimeEntry[]): DailyTotal["verification"] {
  const required = entries.filter((entry) => entry.verification_required);
  if (!required.length) return "not-required";
  const verified = required.filter((entry) => entry.verified).length;
  if (verified === required.length) return "verified";
  return verified > 0 ? "partial" : "needed";
}

export function calculateDailyTotals(
  entries: TimeEntry[],
  categories: Category[],
  semester: Semester,
): DailyTotal[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const grouped = new Map<string, TimeEntry[]>();
  entries
    .filter((entry) => entry.semester_id === semester.id)
    .forEach((entry) => grouped.set(entry.entry_date, [...(grouped.get(entry.entry_date) ?? []), entry]));

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEntries]) => ({
      date,
      hours: dayEntries.reduce((total, entry) => total + entry.duration_minutes / 60, 0),
      credit: calculateDailyCredit(dayEntries, semester),
      pdHours: dayEntries.filter((entry) => entry.counts_pd).reduce((total, entry) => total + entry.duration_minutes / 60, 0),
      absence: dayEntries.some((entry) => categoriesById.get(entry.category_id)?.is_absence),
      closure: dayEntries.some((entry) => categoriesById.get(entry.category_id)?.is_closure),
      verification: verificationState(dayEntries),
      entries: dayEntries,
    }));
}

export function calculateWeeklyTotals(
  entries: TimeEntry[],
  categories: Category[],
  semester: Semester,
  weekStartsOn: 0 | 1 = 0,
): WeeklyTotal[] {
  const days = calculateDailyTotals(entries, categories, semester);
  const grouped = new Map<string, DailyTotal[]>();
  days.forEach((day) => {
    const key = format(startOfWeek(parseISO(day.date), { weekStartsOn }), "yyyy-MM-dd");
    grouped.set(key, [...(grouped.get(key) ?? []), day]);
  });
  return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([weekStart, weekDays]) => {
    const states = weekDays.map((day) => day.verification);
    const verification = states.includes("needed") ? "needed" : states.includes("partial") ? "partial" : states.includes("verified") ? "verified" : "not-required";
    return {
      weekStart,
      hours: sum(weekDays.map((day) => day.hours)),
      clinicalDays: sum(weekDays.map((day) => day.credit)),
      pdHours: sum(weekDays.map((day) => day.pdHours)),
      absences: weekDays.filter((day) => day.absence).length,
      closures: weekDays.filter((day) => day.closure).length,
      verification,
      days: weekDays,
    };
  });
}

function sum(values: number[]): number {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

function currentStreak(days: DailyTotal[]): number {
  const credited = days.filter((day) => day.credit > 0).map((day) => day.date).sort().reverse();
  if (!credited.length) return 0;
  let streak = 1;
  for (let index = 1; index < credited.length; index += 1) {
    const gap = differenceInCalendarDays(parseISO(credited[index - 1]), parseISO(credited[index]));
    if (gap <= 3) streak += 1;
    else break;
  }
  return streak;
}

export function calculateProjectedCompletion(days: DailyTotal[], semester: Semester, today = new Date()): string | null {
  const completed = sum(days.map((day) => day.credit));
  if (completed >= semester.required_clinical_days) {
    return days.filter((day) => day.credit > 0).at(-1)?.date ?? semester.end_date;
  }
  const semesterStart = parseISO(semester.start_date);
  const elapsed = Math.max(1, differenceInCalendarDays(today, semesterStart) + 1);
  const rate = completed / elapsed;
  if (rate <= 0) return null;
  const projected = addDays(today, Math.ceil((semester.required_clinical_days - completed) / rate));
  return format(projected, "yyyy-MM-dd");
}

export function calculateSemesterProgress(
  entries: TimeEntry[], categories: Category[], semester: Semester, today = new Date(),
): ProgressSummary {
  const days = calculateDailyTotals(entries, categories, semester);
  const clinicalDays = sum(days.map((day) => day.credit));
  const semesterHours = sum(days.map((day) => day.hours));
  const creditedDays = days.filter((day) => day.credit > 0);
  const currentMonth = format(today, "yyyy-MM");
  return {
    clinicalDays,
    requiredDays: semester.required_clinical_days,
    remainingDays: Math.max(0, sum([semester.required_clinical_days, -clinicalDays])),
    semesterHours,
    monthHours: sum(days.filter((day) => day.date.startsWith(currentMonth)).map((day) => day.hours)),
    averageHoursPerDay: creditedDays.length ? sum([semesterHours / creditedDays.length]) : 0,
    pdHours: sum(days.map((day) => day.pdHours)),
    absences: days.filter((day) => day.absence).length,
    closures: days.filter((day) => day.closure).length,
    unverified: entries.filter((entry) => entry.semester_id === semester.id && entry.verification_required && !entry.verified).length,
    streak: currentStreak(days),
    projectedCompletion: calculateProjectedCompletion(days, semester, today),
    percent: semester.required_clinical_days ? Math.min(100, Math.round((clinicalDays / semester.required_clinical_days) * 100)) : 0,
  };
}

export function isEntryInSemester(entry: TimeEntry, semester: Semester): boolean {
  const date = parseISO(entry.entry_date);
  return entry.semester_id === semester.id && !isBefore(date, parseISO(semester.start_date)) && !isAfter(date, parseISO(semester.end_date));
}
