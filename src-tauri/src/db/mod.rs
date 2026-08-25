pub mod migrations;
pub mod models;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub type DbPool = Pool<SqliteConnectionManager>;

#[derive(Clone)]
pub struct DbState {
    pub pool: DbPool,
    pub app_data_dir: PathBuf,
}

pub fn initialize(app: &AppHandle) -> Result<DbState, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;
    std::fs::create_dir_all(app_data_dir.join("backups"))?;
    let db_path = app_data_dir.join("teaching-time-tracker.sqlite");

    let manager = SqliteConnectionManager::file(&db_path).with_init(|conn| {
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=FULL;
             PRAGMA foreign_keys=ON;
             PRAGMA busy_timeout=5000;
             PRAGMA temp_store=MEMORY;",
        )
    });
    let pool = Pool::builder().max_size(8).build(manager)?;
    migrations::run(&pool)?;

    Ok(DbState { pool, app_data_dir })
}
