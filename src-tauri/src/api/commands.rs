use crate::db::{models::*, DbState};
use crate::error::{AppError, AppResult};
use chrono::NaiveDate;
use rusqlite::{params, OptionalExtension, Row};
use tauri::State;
use uuid::Uuid;

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn bool_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn validate_date(value: &str, label: &str) -> AppResult<()> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| AppError::Validation(format!("{label} must be a valid YYYY-MM-DD date")))
}

fn semester_from_row(row: &Row<'_>) -> rusqlite::Result<Semester> {
    Ok(Semester {
        id: row.get("id")?,
        name: row.get("name")?,
        start_date: row.get("start_date")?,
        end_date: row.get("end_date")?,
        required_clinical_days: row.get("required_clinical_days")?,
        required_pd_hours: row.get("required_pd_hours")?,
        half_day_threshold: row.get("half_day_threshold")?,
        full_day_threshold: row.get("full_day_threshold")?,
        partial_hours_accumulate: row.get::<_, i64>("partial_hours_accumulate")? != 0,
        pd_counts_clinical: row.get::<_, i64>("pd_counts_clinical")? != 0,
        subbing_counts: row.get::<_, i64>("subbing_counts")? != 0,
        school: row.get("school")?,
        cooperating_teacher: row
            .get::<_, Option<String>>("cooperating_teacher")?
            .unwrap_or_default(),
        university_supervisor: row
            .get::<_, Option<String>>("university_supervisor")?
            .unwrap_or_default(),
        archived: row.get::<_, i64>("archived")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn category_from_row(row: &Row<'_>) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get("id")?,
        name: row.get("name")?,
        abbreviation: row.get("abbreviation")?,
        color: row.get("color")?,
        icon: row.get("icon")?,
        counts_clinical: row.get::<_, i64>("counts_clinical")? != 0,
        counts_pd: row.get::<_, i64>("counts_pd")? != 0,
        is_absence: row.get::<_, i64>("is_absence")? != 0,
        is_closure: row.get::<_, i64>("is_closure")? != 0,
        active: row.get::<_, i64>("active")? != 0,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn entry_from_row(row: &Row<'_>) -> rusqlite::Result<TimeEntry> {
    Ok(TimeEntry {
        id: row.get("id")?,
        semester_id: row.get("semester_id")?,
        category_id: row.get("category_id")?,
        entry_date: row.get("entry_date")?,
        start_time: row.get("start_time")?,
        end_time: row.get("end_time")?,
        duration_minutes: row.get("duration_minutes")?,
        all_day: row.get::<_, i64>("all_day")? != 0,
        counts_clinical: row.get::<_, i64>("counts_clinical")? != 0,
        counts_pd: row.get::<_, i64>("counts_pd")? != 0,
        day_credit_override: row.get("day_credit_override")?,
        location: row
            .get::<_, Option<String>>("location")?
            .unwrap_or_default(),
        teacher: row.get::<_, Option<String>>("teacher")?.unwrap_or_default(),
        description: row.get("description")?,
        notes: row.get("notes")?,
        verification_required: row.get::<_, i64>("verification_required")? != 0,
        verified: row.get::<_, i64>("verified")? != 0,
        verified_date: row.get("verified_date")?,
        verifier_name: row
            .get::<_, Option<String>>("verifier_name")?
            .unwrap_or_default(),
        verifier_initials: row
            .get::<_, Option<String>>("verifier_initials")?
            .unwrap_or_default(),
        attachment_reference: row
            .get::<_, Option<String>>("attachment_reference")?
            .unwrap_or_default(),
        recurrence_group_id: row.get("recurrence_group_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn note_from_row(row: &Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get("id")?,
        title: row.get("title")?,
        body: row.get("body")?,
        pinned: row.get::<_, i64>("pinned")? != 0,
        linked_date: row.get("linked_date")?,
        semester_id: row.get("semester_id")?,
        time_entry_id: row.get("time_entry_id")?,
        tags: row.get("tags")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn reminder_from_row(row: &Row<'_>) -> rusqlite::Result<Reminder> {
    Ok(Reminder {
        id: row.get("id")?,
        reminder_type: row.get("reminder_type")?,
        title: row.get("title")?,
        enabled: row.get::<_, i64>("enabled")? != 0,
        days: row.get("days")?,
        time_of_day: row.get("time_of_day")?,
        semester_id: row.get("semester_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn backup_from_row(row: &Row<'_>) -> rusqlite::Result<BackupRecord> {
    Ok(BackupRecord {
        id: row.get("id")?,
        destination: row.get("destination")?,
        file_path: row.get("file_path")?,
        checksum: row.get("checksum")?,
        device_id: row.get("device_id")?,
        backup_version: row.get("backup_version")?,
        size_bytes: row.get("size_bytes")?,
        encrypted: row.get::<_, i64>("encrypted")? != 0,
        status: row.get("status")?,
        error: row.get("error")?,
        created_at: row.get("created_at")?,
    })
}

fn seed_categories(conn: &rusqlite::Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(());
    }
    let defaults = [
        ("Teaching", "TEA", "#6f8edb", "BookOpen", 1, 0, 0, 0),
        (
            "Professional Development",
            "PD",
            "#72b69a",
            "GraduationCap",
            0,
            1,
            0,
            0,
        ),
        ("Subbing", "SUB", "#7cb7d8", "Users", 1, 0, 0, 0),
        ("Courses / Breaks", "CRS", "#e8aa63", "Coffee", 0, 0, 0, 0),
        ("Meetings", "MTG", "#a28ac7", "MessagesSquare", 0, 0, 0, 0),
        ("Planning", "PLN", "#55a9a3", "ClipboardList", 0, 0, 0, 0),
        ("Grading", "GRD", "#df7f78", "CheckSquare", 0, 0, 0, 0),
        ("Observation", "OBS", "#7176bc", "Eye", 1, 0, 0, 0),
        ("Absence", "ABS", "#cf6467", "CircleAlert", 0, 0, 1, 0),
        ("School Closure", "CLS", "#969ba5", "School", 0, 0, 0, 1),
        ("Other", "OTH", "#7e899b", "MoreHorizontal", 0, 0, 0, 0),
    ];
    let timestamp = now();
    for (index, item) in defaults.iter().enumerate() {
        conn.execute(
            "INSERT INTO categories(id,name,abbreviation,color,icon,counts_clinical,counts_pd,is_absence,is_closure,active,sort_order,created_at,updated_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,1,?10,?11,?11)",
            params![Uuid::new_v4().to_string(), item.0, item.1, item.2, item.3, item.4, item.5, item.6, item.7, index as i64, timestamp],
        )?;
    }
    Ok(())
}

fn read_settings(conn: &rusqlite::Connection) -> AppSettings {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key='preferences'",
        [],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|json| serde_json::from_str(&json).ok())
    .unwrap_or_default()
}

pub fn build_snapshot(conn: &rusqlite::Connection) -> AppResult<AppSnapshot> {
    seed_categories(conn)?;
    let semester_sql = "SELECT s.*, COALESCE(sc.name,'') AS school FROM semesters s LEFT JOIN schools sc ON sc.id=s.school_id WHERE s.deleted_at IS NULL ORDER BY s.archived, s.start_date DESC";
    let semesters = conn
        .prepare(semester_sql)?
        .query_map([], semester_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    let categories = conn
        .prepare("SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order,name")?
        .query_map([], category_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    let entries = conn
        .prepare(
            "SELECT * FROM time_entries WHERE deleted_at IS NULL ORDER BY entry_date,start_time",
        )?
        .query_map([], entry_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    let notes = conn
        .prepare(
            "SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY pinned DESC,updated_at DESC",
        )?
        .query_map([], note_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    let reminders = conn
        .prepare(
            "SELECT * FROM reminders WHERE deleted_at IS NULL ORDER BY enabled DESC,time_of_day",
        )?
        .query_map([], reminder_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    let backups = conn
        .prepare("SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 100")?
        .query_map([], backup_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(AppSnapshot {
        semesters,
        categories,
        entries,
        notes,
        reminders,
        backups,
        settings: read_settings(conn),
    })
}

#[tauri::command]
pub fn get_app_snapshot(db: State<'_, DbState>) -> AppResult<AppSnapshot> {
    let conn = db.pool.get()?;
    build_snapshot(&conn)
}

#[tauri::command]
pub fn save_semester(input: SemesterInput, db: State<'_, DbState>) -> AppResult<AppSnapshot> {
    validate_date(&input.start_date, "Start date")?;
    validate_date(&input.end_date, "End date")?;
    if input.end_date < input.start_date {
        return Err(AppError::Validation(
            "Semester end date must follow its start date".into(),
        ));
    }
    if input.name.trim().is_empty() {
        return Err(AppError::Validation("Semester name is required".into()));
    }
    if input.full_day_threshold < input.half_day_threshold || input.half_day_threshold < 0.0 {
        return Err(AppError::Validation(
            "Full-day threshold must be at least the half-day threshold".into(),
        ));
    }
    let mut conn = db.pool.get()?;
    let tx = conn.transaction()?;
    let timestamp = now();
    let semester_id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let school_id = if input.school.trim().is_empty() {
        None
    } else {
        let existing: Option<String> = tx
            .query_row(
                "SELECT id FROM schools WHERE lower(name)=lower(?1) AND deleted_at IS NULL",
                params![input.school.trim()],
                |r| r.get(0),
            )
            .optional()?;
        match existing {
            Some(id) => Some(id),
            None => {
                let id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO schools(id,name,created_at,updated_at) VALUES(?1,?2,?3,?3)",
                    params![id, input.school.trim(), timestamp],
                )?;
                Some(id)
            }
        }
    };
    tx.execute(
        "INSERT INTO semesters(id,name,start_date,end_date,required_clinical_days,required_pd_hours,half_day_threshold,full_day_threshold,partial_hours_accumulate,pd_counts_clinical,subbing_counts,school_id,cooperating_teacher,university_supervisor,archived,created_at,updated_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?16)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name,start_date=excluded.start_date,end_date=excluded.end_date,required_clinical_days=excluded.required_clinical_days,required_pd_hours=excluded.required_pd_hours,half_day_threshold=excluded.half_day_threshold,full_day_threshold=excluded.full_day_threshold,partial_hours_accumulate=excluded.partial_hours_accumulate,pd_counts_clinical=excluded.pd_counts_clinical,subbing_counts=excluded.subbing_counts,school_id=excluded.school_id,cooperating_teacher=excluded.cooperating_teacher,university_supervisor=excluded.university_supervisor,archived=excluded.archived,updated_at=excluded.updated_at",
        params![semester_id,input.name.trim(),input.start_date,input.end_date,input.required_clinical_days,input.required_pd_hours,input.half_day_threshold,input.full_day_threshold,bool_int(input.partial_hours_accumulate),bool_int(input.pd_counts_clinical),bool_int(input.subbing_counts),school_id,input.cooperating_teacher.trim(),input.university_supervisor.trim(),bool_int(input.archived),timestamp],
    )?;
    let mut settings = read_settings(&tx);
    if settings.active_semester_id.is_none() {
        settings.active_semester_id = Some(semester_id);
    }
    let settings_json =
        serde_json::to_string(&settings).map_err(|e| AppError::Internal(e.to_string()))?;
    tx.execute("INSERT INTO app_settings(key,value,created_at,updated_at) VALUES('preferences',?1,?2,?2) ON CONFLICT(key) DO UPDATE SET value=?1,updated_at=?2", params![settings_json,timestamp])?;
    tx.commit()?;
    build_snapshot(&conn)
}

#[tauri::command]
pub fn save_category(input: CategoryInput, db: State<'_, DbState>) -> AppResult<AppSnapshot> {
    if input.name.trim().is_empty() || input.abbreviation.trim().is_empty() {
        return Err(AppError::Validation(
            "Category name and abbreviation are required".into(),
        ));
    }
    if !input.color.starts_with('#') || input.color.len() != 7 {
        return Err(AppError::Validation(
            "Category color must be a six-digit hex color".into(),
        ));
    }
    let conn = db.pool.get()?;
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let timestamp = now();
    conn.execute(
        "INSERT INTO categories(id,name,abbreviation,color,icon,counts_clinical,counts_pd,is_absence,is_closure,active,sort_order,created_at,updated_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name,abbreviation=excluded.abbreviation,color=excluded.color,icon=excluded.icon,counts_clinical=excluded.counts_clinical,counts_pd=excluded.counts_pd,is_absence=excluded.is_absence,is_closure=excluded.is_closure,active=excluded.active,sort_order=excluded.sort_order,updated_at=excluded.updated_at",
        params![id,input.name.trim(),input.abbreviation.trim().to_uppercase(),input.color,input.icon,bool_int(input.counts_clinical),bool_int(input.counts_pd),bool_int(input.is_absence),bool_int(input.is_closure),bool_int(input.active),input.sort_order,timestamp],
    )?;
    build_snapshot(&conn)
}

fn validate_time_entry(input: &TimeEntryInput, conn: &rusqlite::Connection) -> AppResult<()> {
    validate_date(&input.entry_date, "Entry date")?;
    if input.duration_minutes < 0 {
        return Err(AppError::Validation("Duration cannot be negative".into()));
    }
    if let (Some(start), Some(end)) = (&input.start_time, &input.end_time) {
        if end <= start {
            return Err(AppError::Validation(
                "End time must be after start time".into(),
            ));
        }
    }
    if input.verified && !input.verification_required {
        return Err(AppError::Validation(
            "Only verification-required entries can be marked verified".into(),
        ));
    }
    let semester_range: Option<(String, String)> = conn
        .query_row(
            "SELECT start_date,end_date FROM semesters WHERE id=?1 AND deleted_at IS NULL",
            params![input.semester_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let Some((start, end)) = semester_range else {
        return Err(AppError::NotFound("Semester".into()));
    };
    if input.entry_date < start || input.entry_date > end {
        return Err(AppError::Validation(
            "Entry date must be inside the selected semester".into(),
        ));
    }
    let category_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1 AND deleted_at IS NULL)",
        params![input.category_id],
        |r| r.get(0),
    )?;
    if !category_exists {
        return Err(AppError::NotFound("Category".into()));
    }
    Ok(())
}

#[tauri::command]
pub fn save_time_entry(input: TimeEntryInput, db: State<'_, DbState>) -> AppResult<AppSnapshot> {
    let mut conn = db.pool.get()?;
    validate_time_entry(&input, &conn)?;
    let tx = conn.transaction()?;
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let timestamp = now();
    tx.execute(
        "INSERT INTO time_entries(id,semester_id,category_id,entry_date,start_time,end_time,duration_minutes,all_day,counts_clinical,counts_pd,day_credit_override,location,teacher,description,notes,verification_required,verified,verified_date,verifier_name,verifier_initials,attachment_reference,recurrence_group_id,created_at,updated_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?23)
         ON CONFLICT(id) DO UPDATE SET semester_id=excluded.semester_id,category_id=excluded.category_id,entry_date=excluded.entry_date,start_time=excluded.start_time,end_time=excluded.end_time,duration_minutes=excluded.duration_minutes,all_day=excluded.all_day,counts_clinical=excluded.counts_clinical,counts_pd=excluded.counts_pd,day_credit_override=excluded.day_credit_override,location=excluded.location,teacher=excluded.teacher,description=excluded.description,notes=excluded.notes,verification_required=excluded.verification_required,verified=excluded.verified,verified_date=excluded.verified_date,verifier_name=excluded.verifier_name,verifier_initials=excluded.verifier_initials,attachment_reference=excluded.attachment_reference,recurrence_group_id=excluded.recurrence_group_id,updated_at=excluded.updated_at",
        params![id,input.semester_id,input.category_id,input.entry_date,input.start_time,input.end_time,input.duration_minutes,bool_int(input.all_day),bool_int(input.counts_clinical),bool_int(input.counts_pd),input.day_credit_override,input.location.trim(),input.teacher.trim(),input.description.trim(),input.notes.trim(),bool_int(input.verification_required),bool_int(input.verified),input.verified_date,input.verifier_name.trim(),input.verifier_initials.trim(),input.attachment_reference.trim(),input.recurrence_group_id,timestamp],
    )?;
    tx.commit()?;
    build_snapshot(&conn)
}

#[tauri::command]
pub fn delete_time_entry(
    id: String,
    confirmed: bool,
    db: State<'_, DbState>,
) -> AppResult<AppSnapshot> {
    if !confirmed {
        return Err(AppError::Validation("Deletion must be confirmed".into()));
    }
    let conn = db.pool.get()?;
    let affected = conn.execute(
        "UPDATE time_entries SET deleted_at=?1,updated_at=?1 WHERE id=?2 AND deleted_at IS NULL",
        params![now(), id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound("Time entry".into()));
    }
    build_snapshot(&conn)
}

#[tauri::command]
pub fn duplicate_time_entry(
    id: String,
    entry_date: String,
    db: State<'_, DbState>,
) -> AppResult<AppSnapshot> {
    validate_date(&entry_date, "Entry date")?;
    let conn = db.pool.get()?;
    let source = conn
        .query_row(
            "SELECT * FROM time_entries WHERE id=?1 AND deleted_at IS NULL",
            params![id],
            entry_from_row,
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound("Time entry".into()))?;
    let input = TimeEntryInput {
        id: None,
        semester_id: source.semester_id,
        category_id: source.category_id,
        entry_date,
        start_time: source.start_time,
        end_time: source.end_time,
        duration_minutes: source.duration_minutes,
        all_day: source.all_day,
        counts_clinical: source.counts_clinical,
        counts_pd: source.counts_pd,
        day_credit_override: source.day_credit_override,
        location: source.location,
        teacher: source.teacher,
        description: source.description,
        notes: source.notes,
        verification_required: source.verification_required,
        verified: false,
        verified_date: None,
        verifier_name: String::new(),
        verifier_initials: String::new(),
        attachment_reference: source.attachment_reference,
        recurrence_group_id: source.recurrence_group_id,
    };
    drop(conn);
    save_time_entry(input, db)
}

#[tauri::command]
pub fn bulk_verify(
    ids: Vec<String>,
    verifier_name: String,
    db: State<'_, DbState>,
) -> AppResult<AppSnapshot> {
    if ids.is_empty() {
        return Err(AppError::Validation("Select at least one entry".into()));
    }
    let mut conn = db.pool.get()?;
    let tx = conn.transaction()?;
    let timestamp = now();
    let verified_date = chrono::Local::now()
        .date_naive()
        .format("%Y-%m-%d")
        .to_string();
    for id in ids {
        tx.execute("UPDATE time_entries SET verified=1,verified_date=?1,verifier_name=?2,updated_at=?3 WHERE id=?4 AND verification_required=1 AND deleted_at IS NULL", params![verified_date,verifier_name,timestamp,id])?;
    }
    tx.commit()?;
    build_snapshot(&conn)
}

#[tauri::command]
pub fn save_note(input: NoteInput, db: State<'_, DbState>) -> AppResult<AppSnapshot> {
    if input.title.trim().is_empty() {
        return Err(AppError::Validation("Note title is required".into()));
    }
    if let Some(date) = &input.linked_date {
        validate_date(date, "Linked date")?;
    }
    let conn = db.pool.get()?;
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let timestamp = now();
    conn.execute(
        "INSERT INTO notes(id,title,body,pinned,linked_date,semester_id,time_entry_id,tags,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,pinned=excluded.pinned,linked_date=excluded.linked_date,semester_id=excluded.semester_id,time_entry_id=excluded.time_entry_id,tags=excluded.tags,updated_at=excluded.updated_at",
        params![id,input.title.trim(),input.body,bool_int(input.pinned),input.linked_date,input.semester_id,input.time_entry_id,input.tags,timestamp],
    )?;
    build_snapshot(&conn)
}

#[tauri::command]
pub fn delete_note(id: String, confirmed: bool, db: State<'_, DbState>) -> AppResult<AppSnapshot> {
    if !confirmed {
        return Err(AppError::Validation("Deletion must be confirmed".into()));
    }
    let conn = db.pool.get()?;
    conn.execute(
        "UPDATE notes SET deleted_at=?1,updated_at=?1 WHERE id=?2 AND deleted_at IS NULL",
        params![now(), id],
    )?;
    build_snapshot(&conn)
}

#[tauri::command]
pub fn save_reminder(input: ReminderInput, db: State<'_, DbState>) -> AppResult<AppSnapshot> {
    if input.title.trim().is_empty() {
        return Err(AppError::Validation("Reminder title is required".into()));
    }
    let conn = db.pool.get()?;
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let timestamp = now();
    conn.execute(
        "INSERT INTO reminders(id,reminder_type,title,enabled,days,time_of_day,semester_id,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?8)
         ON CONFLICT(id) DO UPDATE SET reminder_type=excluded.reminder_type,title=excluded.title,enabled=excluded.enabled,days=excluded.days,time_of_day=excluded.time_of_day,semester_id=excluded.semester_id,updated_at=excluded.updated_at",
        params![id,input.reminder_type,input.title.trim(),bool_int(input.enabled),input.days,input.time_of_day,input.semester_id,timestamp],
    )?;
    build_snapshot(&conn)
}

#[tauri::command]
pub fn delete_reminder(
    id: String,
    confirmed: bool,
    db: State<'_, DbState>,
) -> AppResult<AppSnapshot> {
    if !confirmed {
        return Err(AppError::Validation("Deletion must be confirmed".into()));
    }
    let conn = db.pool.get()?;
    conn.execute(
        "UPDATE reminders SET deleted_at=?1,updated_at=?1 WHERE id=?2 AND deleted_at IS NULL",
        params![now(), id],
    )?;
    build_snapshot(&conn)
}

#[tauri::command]
pub fn save_settings(settings: AppSettings, db: State<'_, DbState>) -> AppResult<AppSnapshot> {
    let conn = db.pool.get()?;
    let value = serde_json::to_string(&settings).map_err(|e| AppError::Internal(e.to_string()))?;
    let timestamp = now();
    conn.execute("INSERT INTO app_settings(key,value,created_at,updated_at) VALUES('preferences',?1,?2,?2) ON CONFLICT(key) DO UPDATE SET value=?1,updated_at=?2", params![value,timestamp])?;
    build_snapshot(&conn)
}

#[tauri::command]
pub fn export_data(
    format: String,
    semester_id: Option<String>,
    db: State<'_, DbState>,
) -> AppResult<String> {
    let conn = db.pool.get()?;
    let snapshot = build_snapshot(&conn)?;
    let entries: Vec<_> = snapshot
        .entries
        .iter()
        .filter(|e| semester_id.as_ref().is_none_or(|id| &e.semester_id == id))
        .collect();
    match format.as_str() {
        "json" => {
            serde_json::to_string_pretty(&snapshot).map_err(|e| AppError::Internal(e.to_string()))
        }
        "csv" => {
            let mut out = String::from("date,category_id,start_time,end_time,duration_hours,clinical,pd,verified,location,description,notes\n");
            for e in entries {
                let escape = |s: &str| format!("\"{}\"", s.replace('"', "\"\""));
                out.push_str(&format!(
                    "{},{},{},{},{:.2},{},{},{},{},{},{}\n",
                    e.entry_date,
                    e.category_id,
                    e.start_time.as_deref().unwrap_or(""),
                    e.end_time.as_deref().unwrap_or(""),
                    e.duration_minutes as f64 / 60.0,
                    e.counts_clinical,
                    e.counts_pd,
                    e.verified,
                    escape(&e.location),
                    escape(&e.description),
                    escape(&e.notes)
                ));
            }
            Ok(out)
        }
        _ => Err(AppError::Validation(
            "Export format must be csv or json".into(),
        )),
    }
}
