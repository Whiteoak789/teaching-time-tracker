import { describe, expect, it } from "vitest";
import { calculateDailyCredit, calculateSemesterProgress, calculateWeeklyTotals } from "./calculations";
import type { Category, Semester, TimeEntry } from "@/types";

const semester: Semester = {
  id: "s1", name: "Spring 2027", start_date: "2027-01-11", end_date: "2027-05-14",
  required_clinical_days: 70, required_pd_hours: 10, half_day_threshold: 5, full_day_threshold: 6,
  partial_hours_accumulate: false, pd_counts_clinical: false, subbing_counts: true, school: "Central",
  cooperating_teacher: "A", university_supervisor: "B", archived: false, created_at: "", updated_at: "",
};
const category: Category = { id: "c1", name: "Teaching", abbreviation: "TEA", color: "#000000", icon: "BookOpen", counts_clinical: true, counts_pd: false, is_absence: false, is_closure: false, active: true, sort_order: 0, created_at: "", updated_at: "" };
const entry = (overrides: Partial<TimeEntry> = {}): TimeEntry => ({ id: crypto.randomUUID(), semester_id: "s1", category_id: "c1", entry_date: "2027-01-11", start_time: "08:00", end_time: "14:00", duration_minutes: 360, all_day: false, counts_clinical: true, counts_pd: false, day_credit_override: null, location: "", teacher: "", description: "", notes: "", verification_required: false, verified: false, verified_date: null, verifier_name: "", verifier_initials: "", attachment_reference: "", recurrence_group_id: null, created_at: "", updated_at: "", ...overrides });

describe("clinical day calculations", () => {
  it("applies full and half-day thresholds", () => {
    expect(calculateDailyCredit([entry()], semester)).toBe(1);
    expect(calculateDailyCredit([entry({ duration_minutes: 300 })], semester)).toBe(0.5);
    expect(calculateDailyCredit([entry({ duration_minutes: 240 })], semester)).toBe(0);
  });
  it("honors manual override and excludes nonclinical time", () => {
    expect(calculateDailyCredit([entry({ day_credit_override: 0.75 })], semester)).toBe(0.75);
    expect(calculateDailyCredit([entry({ counts_clinical: false })], semester)).toBe(0);
  });
  it("accumulates partial hours when configured", () => {
    expect(calculateDailyCredit([entry({ duration_minutes: 180 })], { ...semester, partial_hours_accumulate: true })).toBe(0.5);
  });
});

describe("rollups", () => {
  const entries = [entry(), entry({ id: "second", entry_date: "2027-01-12", duration_minutes: 300, counts_pd: true, verification_required: true })];
  it("calculates semester progress", () => {
    const result = calculateSemesterProgress(entries, [category], semester, new Date("2027-01-12T12:00:00"));
    expect(result.clinicalDays).toBe(1.5);
    expect(result.semesterHours).toBe(11);
    expect(result.pdHours).toBe(5);
    expect(result.unverified).toBe(1);
    expect(result.remainingDays).toBe(68.5);
  });
  it("calculates weekly totals and status", () => {
    const weeks = calculateWeeklyTotals(entries, [category], semester, 0);
    expect(weeks[0].clinicalDays).toBe(1.5);
    expect(weeks[0].verification).toBe("needed");
  });
});
