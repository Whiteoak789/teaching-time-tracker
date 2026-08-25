export interface Semester {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  required_clinical_days: number;
  required_pd_hours: number;
  half_day_threshold: number;
  full_day_threshold: number;
  partial_hours_accumulate: boolean;
  pd_counts_clinical: boolean;
  subbing_counts: boolean;
  school: string;
  cooperating_teacher: string;
  university_supervisor: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type SemesterInput = Omit<Semester, "id" | "created_at" | "updated_at"> & { id?: string };

export interface Category {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  icon: string;
  counts_clinical: boolean;
  counts_pd: boolean;
  is_absence: boolean;
  is_closure: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CategoryInput = Omit<Category, "id" | "created_at" | "updated_at"> & { id?: string };

export interface TimeEntry {
  id: string;
  semester_id: string;
  category_id: string;
  entry_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  all_day: boolean;
  counts_clinical: boolean;
  counts_pd: boolean;
  day_credit_override: number | null;
  location: string;
  teacher: string;
  description: string;
  notes: string;
  verification_required: boolean;
  verified: boolean;
  verified_date: string | null;
  verifier_name: string;
  verifier_initials: string;
  attachment_reference: string;
  recurrence_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TimeEntryInput = Omit<TimeEntry, "id" | "created_at" | "updated_at"> & { id?: string };

export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  linked_date: string | null;
  semester_id: string | null;
  time_entry_id: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
}

export type NoteInput = Omit<Note, "id" | "created_at" | "updated_at"> & { id?: string };

export interface Reminder {
  id: string;
  reminder_type: string;
  title: string;
  enabled: boolean;
  days: string;
  time_of_day: string;
  semester_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ReminderInput = Omit<Reminder, "id" | "created_at" | "updated_at"> & { id?: string };

export interface BackupRecord {
  id: string;
  destination: string;
  file_path: string;
  checksum: string;
  device_id: string;
  backup_version: number;
  size_bytes: number;
  encrypted: boolean;
  status: string;
  error: string | null;
  created_at: string;
}

export interface AppSettings {
  active_semester_id?: string;
  theme?: "light" | "dark" | "system";
  week_starts_on?: "sunday" | "monday";
  clock_format?: "12" | "24";
  date_format?: string;
  default_duration?: number;
  default_category_id?: string;
  backup_on_close?: boolean;
  automatic_backup?: boolean;
  backup_frequency?: "daily" | "weekly";
  backup_retention_count?: number;
  last_backup_at?: string;
  backup_directory?: string;
}

export interface AppSnapshot {
  semesters: Semester[];
  categories: Category[];
  entries: TimeEntry[];
  notes: Note[];
  reminders: Reminder[];
  backups: BackupRecord[];
  settings: AppSettings;
}

export interface DailyTotal {
  date: string;
  hours: number;
  credit: number;
  pdHours: number;
  absence: boolean;
  closure: boolean;
  verification: "verified" | "partial" | "needed" | "not-required";
  entries: TimeEntry[];
}

export interface WeeklyTotal {
  weekStart: string;
  hours: number;
  clinicalDays: number;
  pdHours: number;
  absences: number;
  closures: number;
  verification: DailyTotal["verification"];
  days: DailyTotal[];
}

export interface ProgressSummary {
  clinicalDays: number;
  requiredDays: number;
  remainingDays: number;
  semesterHours: number;
  monthHours: number;
  averageHoursPerDay: number;
  pdHours: number;
  absences: number;
  closures: number;
  unverified: number;
  streak: number;
  projectedCompletion: string | null;
  percent: number;
}
