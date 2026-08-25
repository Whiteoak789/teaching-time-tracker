use crate::api::commands::build_snapshot;
use crate::db::{
    models::{AppSettings, AppSnapshot, BackupRecord, BackupRequest, RestoreRequest},
    DbState,
};
use crate::error::{AppError, AppResult};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use rand::RngCore;
use rusqlite::{backup::Backup, params};
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::{Read, Write},
    path::{Path, PathBuf},
};
use tauri::State;
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

const MAGIC: &[u8; 7] = b"TTTENC1";

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn device_id(conn: &rusqlite::Connection) -> AppResult<String> {
    if let Ok(id) = conn.query_row(
        "SELECT value FROM app_settings WHERE key='device_id'",
        [],
        |r| r.get::<_, String>(0),
    ) {
        return Ok(id);
    }
    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    conn.execute(
        "INSERT INTO app_settings(key,value,created_at,updated_at) VALUES('device_id',?1,?2,?2)",
        params![id, timestamp],
    )?;
    Ok(id)
}

fn sha256(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn package_snapshot(
    snapshot_db: &Path,
    snapshot: &AppSnapshot,
    destination: &Path,
) -> AppResult<()> {
    let file = File::create(destination)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o600);
    zip.start_file("database.sqlite", options)?;
    let mut db_file = File::open(snapshot_db)?;
    std::io::copy(&mut db_file, &mut zip)?;
    zip.start_file("metadata.json", options)?;
    let metadata = serde_json::json!({
        "application": "Teaching Time Tracker",
        "backup_version": 1,
        "created_at": now(),
        "semesters": snapshot.semesters.len(),
        "entries": snapshot.entries.len(),
        "notes": snapshot.notes.len()
    });
    zip.write_all(
        serde_json::to_string_pretty(&metadata)
            .map_err(|e| AppError::Backup(e.to_string()))?
            .as_bytes(),
    )?;
    zip.finish()?;
    Ok(())
}

fn encrypt_backup(plain: &[u8], password: &str) -> AppResult<Vec<u8>> {
    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 12];
    rand::rng().fill_bytes(&mut salt);
    rand::rng().fill_bytes(&mut nonce_bytes);
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), &salt, &mut key)
        .map_err(|e| AppError::Backup(e.to_string()))?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| AppError::Backup(e.to_string()))?;
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plain)
        .map_err(|_| AppError::Backup("Encryption failed".into()))?;
    let mut out =
        Vec::with_capacity(MAGIC.len() + salt.len() + nonce_bytes.len() + encrypted.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&encrypted);
    Ok(out)
}

fn decrypt_backup(bytes: &[u8], password: Option<&str>) -> AppResult<Vec<u8>> {
    if !bytes.starts_with(MAGIC) {
        return Ok(bytes.to_vec());
    }
    let password = password
        .filter(|p| !p.is_empty())
        .ok_or_else(|| AppError::Backup("This backup is encrypted; enter its password".into()))?;
    if bytes.len() < 35 {
        return Err(AppError::Backup("Encrypted backup is truncated".into()));
    }
    let salt = &bytes[7..23];
    let nonce = &bytes[23..35];
    let ciphertext = &bytes[35..];
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| AppError::Backup(e.to_string()))?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| AppError::Backup(e.to_string()))?;
    cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| AppError::Backup("Wrong password or damaged encrypted backup".into()))
}

fn snapshot_database(source: &rusqlite::Connection, path: &Path) -> AppResult<()> {
    let mut destination = rusqlite::Connection::open(path)?;
    let backup = Backup::new(source, &mut destination)?;
    backup.run_to_completion(64, std::time::Duration::from_millis(20), None)?;
    drop(backup);
    destination.execute_batch("PRAGMA integrity_check;")?;
    Ok(())
}

pub fn create_backup_internal(request: BackupRequest, state: &DbState) -> AppResult<BackupRecord> {
    let conn = state.pool.get()?;
    let snapshot = build_snapshot(&conn)?;
    let id = Uuid::new_v4().to_string();
    let created_at = now();
    let date_label = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let folder = request
        .destination
        .as_ref()
        .filter(|p| !p.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| state.app_data_dir.join("backups"));
    std::fs::create_dir_all(&folder)?;
    let temp_db = state.app_data_dir.join(format!("snapshot-{id}.sqlite"));
    let temp_package = state.app_data_dir.join(format!("package-{id}.zip"));
    snapshot_database(&conn, &temp_db)?;
    package_snapshot(&temp_db, &snapshot, &temp_package)?;
    let mut bytes = std::fs::read(&temp_package)?;
    let encrypted = request.password.as_ref().is_some_and(|p| !p.is_empty());
    if encrypted {
        bytes = encrypt_backup(&bytes, request.password.as_deref().unwrap_or_default())?;
    }
    let destination = folder.join(format!(
        "Teaching-Time-Tracker-{date_label}.teachingtracker"
    ));
    std::fs::write(&destination, &bytes)?;
    let _ = std::fs::remove_file(&temp_db);
    let _ = std::fs::remove_file(&temp_package);
    let record = BackupRecord {
        id,
        destination: folder.to_string_lossy().into_owned(),
        file_path: destination.to_string_lossy().into_owned(),
        checksum: sha256(&bytes),
        device_id: device_id(&conn)?,
        backup_version: 1,
        size_bytes: bytes.len() as i64,
        encrypted,
        status: "success".into(),
        error: None,
        created_at: created_at.clone(),
    };
    conn.execute("INSERT INTO backup_history(id,destination,file_path,checksum,device_id,backup_version,size_bytes,encrypted,status,error,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)", params![record.id,record.destination,record.file_path,record.checksum,record.device_id,record.backup_version,record.size_bytes,if encrypted {1}else{0},record.status,record.error,record.created_at])?;
    let mut settings: AppSettings = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key='preferences'",
            [],
            |r| r.get::<_, String>(0),
        )
        .ok()
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or_default();
    settings.last_backup_at = Some(created_at.clone());
    settings.backup_directory = Some(folder.to_string_lossy().into_owned());
    conn.execute("INSERT INTO app_settings(key,value,created_at,updated_at) VALUES('preferences',?1,?2,?2) ON CONFLICT(key) DO UPDATE SET value=?1,updated_at=?2", params![serde_json::to_string(&settings).map_err(|e| AppError::Backup(e.to_string()))?,created_at])?;
    prune_backups(&conn, settings.backup_retention_count.unwrap_or(10).max(1))?;
    Ok(record)
}

fn read_settings(conn: &rusqlite::Connection) -> AppSettings {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key='preferences'",
        [],
        |r| r.get::<_, String>(0),
    )
    .ok()
    .and_then(|value| serde_json::from_str(&value).ok())
    .unwrap_or_default()
}

fn prune_backups(conn: &rusqlite::Connection, retain: i64) -> AppResult<()> {
    let mut statement = conn.prepare("SELECT id,file_path FROM backup_history WHERE status='success' ORDER BY created_at DESC LIMIT -1 OFFSET ?1")?;
    let expired = statement
        .query_map(params![retain], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (id, path) in expired {
        if Path::new(&path).is_file() {
            let _ = std::fs::remove_file(&path);
        }
        conn.execute("DELETE FROM backup_history WHERE id=?1", params![id])?;
    }
    Ok(())
}

fn policy_request(state: &DbState, close_event: bool) -> Option<BackupRequest> {
    let conn = state.pool.get().ok()?;
    let settings = read_settings(&conn);
    let enabled = if close_event {
        settings.backup_on_close.unwrap_or(false)
    } else {
        settings.automatic_backup.unwrap_or(false)
    };
    if !enabled {
        return None;
    }
    if !close_event {
        let last = settings
            .last_backup_at
            .as_ref()
            .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok());
        let required_hours = if settings.backup_frequency.as_deref() == Some("daily") {
            24
        } else {
            24 * 7
        };
        if last.is_some_and(|value| {
            chrono::Utc::now()
                .signed_duration_since(value.with_timezone(&chrono::Utc))
                .num_hours()
                < required_hours
        }) {
            return None;
        }
    }
    Some(BackupRequest {
        destination: settings.backup_directory,
        password: None,
    })
}

pub fn scheduled_request(state: &DbState) -> Option<BackupRequest> {
    policy_request(state, false)
}
pub fn close_request(state: &DbState) -> Option<BackupRequest> {
    policy_request(state, true)
}

#[tauri::command]
pub fn create_backup(request: BackupRequest, db: State<'_, DbState>) -> AppResult<BackupRecord> {
    create_backup_internal(request, &db)
}

fn unpack_database(bytes: &[u8], destination: &Path) -> AppResult<()> {
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|_| AppError::Backup("Not a valid Teaching Time Tracker backup".into()))?;
    let mut metadata = String::new();
    archive
        .by_name("metadata.json")?
        .read_to_string(&mut metadata)?;
    let value: serde_json::Value = serde_json::from_str(&metadata)
        .map_err(|_| AppError::Backup("Backup metadata is invalid".into()))?;
    if value.get("application").and_then(|v| v.as_str()) != Some("Teaching Time Tracker") {
        return Err(AppError::Backup(
            "Backup belongs to another application".into(),
        ));
    }
    let mut db = archive.by_name("database.sqlite")?;
    let mut file = File::create(destination)?;
    std::io::copy(&mut db, &mut file)?;
    let check = rusqlite::Connection::open(destination)?;
    let integrity: String = check.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
    if integrity != "ok" {
        return Err(AppError::Backup(format!(
            "Backup database failed integrity check: {integrity}"
        )));
    }
    Ok(())
}

#[tauri::command]
pub fn restore_backup(request: RestoreRequest, db: State<'_, DbState>) -> AppResult<AppSnapshot> {
    if !request.confirmed {
        return Err(AppError::Validation(
            "Restore must be explicitly confirmed".into(),
        ));
    }
    let source_bytes = std::fs::read(&request.file_path)?;
    let plain = decrypt_backup(&source_bytes, request.password.as_deref())?;
    let restored_db = db
        .app_data_dir
        .join(format!("restore-{}.sqlite", Uuid::new_v4()));
    unpack_database(&plain, &restored_db)?;
    create_backup_internal(
        BackupRequest {
            destination: None,
            password: None,
        },
        &db,
    )?;
    let mut conn = db.pool.get()?;
    let source = rusqlite::Connection::open(&restored_db)?;
    let backup = Backup::new(&source, &mut conn)?;
    backup.run_to_completion(64, std::time::Duration::from_millis(20), None)?;
    drop(backup);
    conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA integrity_check;")?;
    let _ = std::fs::remove_file(restored_db);
    build_snapshot(&conn)
}
