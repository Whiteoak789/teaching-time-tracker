use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Semester {
    pub id: String,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub required_clinical_days: f64,
    pub required_pd_hours: f64,
    pub half_day_threshold: f64,
    pub full_day_threshold: f64,
    pub partial_hours_accumulate: bool,
    pub pd_counts_clinical: bool,
    pub subbing_counts: bool,
    pub school: String,
    pub cooperating_teacher: String,
    pub university_supervisor: String,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub abbreviation: String,
    pub color: String,
    pub icon: String,
    pub counts_clinical: bool,
    pub counts_pd: bool,
    pub is_absence: bool,
    pub is_closure: bool,
    pub active: bool,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeEntry {
    pub id: String,
    pub semester_id: String,
    pub category_id: String,
    pub entry_date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub duration_minutes: i64,
    pub all_day: bool,
    pub counts_clinical: bool,
    pub counts_pd: bool,
    pub day_credit_override: Option<f64>,
    pub location: String,
    pub teacher: String,
    pub description: String,
    pub notes: String,
    pub verification_required: bool,
    pub verified: bool,
    pub verified_date: Option<String>,
    pub verifier_name: String,
    pub verifier_initials: String,
    pub attachment_reference: String,
    pub recurrence_group_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body: String,
    pub pinned: bool,
    pub linked_date: Option<String>,
    pub semester_id: Option<String>,
    pub time_entry_id: Option<String>,
    pub tags: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: String,
    pub reminder_type: String,
    pub title: String,
    pub enabled: bool,
    pub days: String,
    pub time_of_day: String,
    pub semester_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRecord {
    pub id: String,
    pub destination: String,
    pub file_path: String,
    pub checksum: String,
    pub device_id: String,
    pub backup_version: i64,
    pub size_bytes: i64,
    pub encrypted: bool,
    pub status: String,
    pub error: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub active_semester_id: Option<String>,
    pub theme: Option<String>,
    pub week_starts_on: Option<String>,
    pub clock_format: Option<String>,
    pub date_format: Option<String>,
    pub default_duration: Option<i64>,
    pub default_category_id: Option<String>,
    pub backup_on_close: Option<bool>,
    pub automatic_backup: Option<bool>,
    pub backup_frequency: Option<String>,
    pub backup_retention_count: Option<i64>,
    pub last_backup_at: Option<String>,
    pub backup_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSnapshot {
    pub semesters: Vec<Semester>,
    pub categories: Vec<Category>,
    pub entries: Vec<TimeEntry>,
    pub notes: Vec<Note>,
    pub reminders: Vec<Reminder>,
    pub backups: Vec<BackupRecord>,
    pub settings: AppSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemesterInput {
    pub id: Option<String>,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub required_clinical_days: f64,
    pub required_pd_hours: f64,
    pub half_day_threshold: f64,
    pub full_day_threshold: f64,
    pub partial_hours_accumulate: bool,
    pub pd_counts_clinical: bool,
    pub subbing_counts: bool,
    pub school: String,
    pub cooperating_teacher: String,
    pub university_supervisor: String,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryInput {
    pub id: Option<String>,
    pub name: String,
    pub abbreviation: String,
    pub color: String,
    pub icon: String,
    pub counts_clinical: bool,
    pub counts_pd: bool,
    pub is_absence: bool,
    pub is_closure: bool,
    pub active: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeEntryInput {
    pub id: Option<String>,
    pub semester_id: String,
    pub category_id: String,
    pub entry_date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub duration_minutes: i64,
    pub all_day: bool,
    pub counts_clinical: bool,
    pub counts_pd: bool,
    pub day_credit_override: Option<f64>,
    pub location: String,
    pub teacher: String,
    pub description: String,
    pub notes: String,
    pub verification_required: bool,
    pub verified: bool,
    pub verified_date: Option<String>,
    pub verifier_name: String,
    pub verifier_initials: String,
    pub attachment_reference: String,
    pub recurrence_group_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteInput {
    pub id: Option<String>,
    pub title: String,
    pub body: String,
    pub pinned: bool,
    pub linked_date: Option<String>,
    pub semester_id: Option<String>,
    pub time_entry_id: Option<String>,
    pub tags: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderInput {
    pub id: Option<String>,
    pub reminder_type: String,
    pub title: String,
    pub enabled: bool,
    pub days: String,
    pub time_of_day: String,
    pub semester_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRequest {
    pub destination: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreRequest {
    pub file_path: String,
    pub password: Option<String>,
    pub confirmed: bool,
}
