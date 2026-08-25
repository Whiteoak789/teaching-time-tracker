use super::DbPool;
use rusqlite::params;

struct Migration {
    version: i32,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "normalized_core_schema",
    sql: r#"
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS supervisors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('cooperating_teacher','university_supervisor','other')),
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  required_clinical_days REAL NOT NULL DEFAULT 70 CHECK(required_clinical_days >= 0),
  required_pd_hours REAL NOT NULL DEFAULT 0 CHECK(required_pd_hours >= 0),
  half_day_threshold REAL NOT NULL DEFAULT 5 CHECK(half_day_threshold >= 0),
  full_day_threshold REAL NOT NULL DEFAULT 6 CHECK(full_day_threshold > 0),
  partial_hours_accumulate INTEGER NOT NULL DEFAULT 0,
  pd_counts_clinical INTEGER NOT NULL DEFAULT 0,
  subbing_counts INTEGER NOT NULL DEFAULT 1,
  school_id TEXT REFERENCES schools(id),
  cooperating_teacher TEXT,
  university_supervisor TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK(end_date >= start_date),
  CHECK(full_day_threshold >= half_day_threshold)
);
CREATE INDEX IF NOT EXISTS idx_semesters_dates ON semesters(start_date, end_date);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  counts_clinical INTEGER NOT NULL DEFAULT 0,
  counts_pd INTEGER NOT NULL DEFAULT 0,
  is_absence INTEGER NOT NULL DEFAULT 0,
  is_closure INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_active ON categories(name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target REAL NOT NULL CHECK(target >= 0),
  unit TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  entry_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes >= 0),
  all_day INTEGER NOT NULL DEFAULT 0,
  counts_clinical INTEGER NOT NULL DEFAULT 0,
  counts_pd INTEGER NOT NULL DEFAULT 0,
  day_credit_override REAL CHECK(day_credit_override IS NULL OR day_credit_override >= 0),
  location TEXT,
  teacher TEXT,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  verification_required INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_date TEXT,
  verifier_name TEXT,
  verifier_initials TEXT,
  attachment_reference TEXT,
  recurrence_group_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK(end_time IS NULL OR start_time IS NULL OR end_time > start_time),
  CHECK(verified = 0 OR verification_required = 1)
);
CREATE INDEX IF NOT EXISTS idx_entries_semester_date ON time_entries(semester_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_entries_category ON time_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_entries_verification ON time_entries(verification_required, verified);

CREATE TABLE IF NOT EXISTS daily_credit_overrides (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  entry_date TEXT NOT NULL,
  credit REAL NOT NULL CHECK(credit >= 0),
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(semester_id, entry_date)
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  linked_date TEXT,
  semester_id TEXT REFERENCES semesters(id),
  time_entry_id TEXT REFERENCES time_entries(id),
  tags TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notes_semester ON notes(semester_id, pinned, updated_at);

CREATE TABLE IF NOT EXISTS weekly_verifications (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  week_start TEXT NOT NULL,
  status TEXT NOT NULL,
  verifier_name TEXT,
  verified_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(semester_id, week_start)
);

CREATE TABLE IF NOT EXISTS backup_destinations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  folder_path TEXT,
  connected INTEGER NOT NULL DEFAULT 0,
  automatic INTEGER NOT NULL DEFAULT 0,
  schedule TEXT NOT NULL DEFAULT 'weekly',
  retain_count INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_history (
  id TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  file_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  device_id TEXT NOT NULL,
  backup_version INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at DESC);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  reminder_type TEXT NOT NULL,
  title TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  days TEXT NOT NULL,
  time_of_day TEXT NOT NULL,
  semester_id TEXT REFERENCES semesters(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  time_entry_id TEXT REFERENCES time_entries(id),
  note_id TEXT REFERENCES notes(id),
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL
);
"#,
}];

pub fn run(pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = pool.get()?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );",
    )?;
    let current: i32 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM _migrations",
        [],
        |row| row.get(0),
    )?;
    for migration in MIGRATIONS.iter().filter(|m| m.version > current) {
        let tx = conn.transaction()?;
        tx.execute_batch(migration.sql)?;
        tx.execute(
            "INSERT INTO _migrations(version, name, applied_at) VALUES(?1, ?2, ?3)",
            params![
                migration.version,
                migration.name,
                chrono::Utc::now().to_rfc3339()
            ],
        )?;
        tx.commit()?;
    }
    Ok(())
}
