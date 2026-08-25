# Architecture — Teaching Time Tracker

Teaching Time Tracker is a layered local-first desktop application. React owns interaction and presentation; reusable TypeScript functions own progress calculations; Rust validates writes and owns persistence, snapshot creation, encryption, and restore safety.

```text
┌──────────────────────── Tauri desktop window ────────────────────────┐
│ React + TypeScript                                                   │
│  Calendar / Timesheet / Summary / Notes / Reports / Settings         │
│             │ Zustand actions         │ pure calculations            │
│             └──────────── invoke() ───┘                              │
├────────────────────────── IPC boundary ──────────────────────────────┤
│ Rust commands → validation → transaction → r2d2 SQLite pool          │
│                                      │                               │
│                           SQLite (WAL + foreign keys)                 │
│                                      │                               │
│                    snapshot → ZIP → optional AES-GCM                 │
│                                      │                               │
│                         selected backup destination                  │
└──────────────────────────────────────────────────────────────────────┘
```

## Data flow

On startup, Rust opens the application database, enables WAL/foreign keys, applies unapplied migrations transactionally, and seeds categories on first read. The frontend requests one typed snapshot and stores it in Zustand. Every mutation goes through a narrow command, is validated in Rust, commits to SQLite, and returns a fresh snapshot so all totals update together.

Credit, weekly totals, progress, streak, and projections are pure functions in `src/lib/calculations.ts`. Keeping policy math outside UI components makes it deterministic and directly testable.

## Backup safety

Backups never copy the live database file. `rusqlite::backup::Backup` creates a consistent temporary snapshot. A ZIP package contains `database.sqlite` and versioned metadata; the final file receives a SHA-256 checksum. Optional encryption derives a 256-bit key with Argon2id and encrypts using AES-256-GCM.

Restore decrypts when needed, validates package identity, runs SQLite `integrity_check`, creates a safety backup, then uses SQLite's backup API to replace database content. Scheduled startup and app-close backups use the same path. Retention removes only successful backup files beyond the configured count.

## Security boundaries

- Tauri 2 capabilities allow only required dialog, file, notification, and opener operations.
- The CSP limits content to packaged assets and Tauri IPC.
- Input is validated in React forms and again in Rust/SQLite constraints.
- OAuth cards are configuration-gated; secrets are not embedded.
- Backup passwords are never stored.
