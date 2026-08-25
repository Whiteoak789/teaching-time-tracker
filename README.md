# Teaching Time Tracker

![Status](https://img.shields.io/badge/status-active-5873ad) ![Tauri](https://img.shields.io/badge/Tauri-2.x-24c8db) ![Offline](https://img.shields.io/badge/data-local--first-5b9b79)

A calm, private desktop workspace for student teachers to record clinical practice, professional development, absences, closures, notes, verification, and semester progress.

## Download

[**Download for macOS (Universal DMG)**](https://github.com/Whiteoak789/teaching-time-tracker/releases/download/v1.0.1/Teaching-Time-Tracker_1.0.1_macOS_universal.dmg) · [**Download for Windows (Setup EXE)**](https://github.com/Whiteoak789/teaching-time-tracker/releases/download/v1.0.1/Teaching-Time-Tracker_1.0.1_Windows_x64-setup.exe) · [Release notes](https://github.com/Whiteoak789/teaching-time-tracker/releases/latest)

- **macOS:** Download the universal `.dmg`, open it, and drag Teaching Time Tracker into Applications. It supports both Apple Silicon and Intel Macs.
- **Windows:** Download the setup `.exe` and run it. The installer creates the app entry and uninstall support automatically.

The first public builds use ad-hoc signing on macOS and are unsigned on Windows. If the operating system asks for confirmation, use **Privacy & Security → Open Anyway** on macOS or **More info → Run anyway** on Windows. Future releases can remove these prompts after Apple and Windows signing certificates are configured.

## What works

- Calendar-first month, week, and list views with drag rescheduling
- Validated time entry editing, manual duration/credit overrides, duplication, and confirmed deletion
- Multiple semesters with configurable half/full-day thresholds and category rules
- Weekly timesheets, verification states, goals, progress projections, and summary charts
- Notes, pinned calendar notes, categories, reminders, search, themes, and keyboard shortcuts
- CSV, JSON, printable, and PDF reports
- Consistent SQLite snapshot backups, optional Argon2id + AES-256-GCM encryption, restore validation, safety backup, checksums, history, scheduling, and retention
- Custom/local/network/external/cloud-mounted backup folders; iCloud Drive works through a selected filesystem folder on macOS

The Google Drive, OneDrive, and Dropbox cards intentionally remain configuration-gated until OAuth application client IDs are supplied. They do not pretend to be connected. Cloud-mounted folders provide a fully working safe-backup route without directly syncing the open database.

## Quick start

Prerequisites: Node.js 20+, current stable Rust, and the [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri:dev
```

Run checks and create a production bundle:

```bash
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

## Publishing a release

Pushing a version tag such as `v1.0.1`, or manually running the **Release installers** workflow, builds both installers on GitHub-hosted macOS and Windows machines. The workflow keeps the release as a draft until both platform builds succeed, then publishes it with stable asset names.

## Project structure

```text
src/
├── api/                 Typed Tauri IPC plus browser preview adapter
├── components/          App shell, onboarding, time form, dialogs, UI primitives
├── lib/                 Tested credit and progress calculations
├── pages/               Calendar and supporting product screens
├── stores/              Zustand application state
└── types/               Shared frontend domain contracts
src-tauri/
├── capabilities/        Least-privilege desktop permissions
└── src/
    ├── api/             Commands and backup/restore implementation
    ├── db/              Pool, normalized migrations, and Rust models
    ├── error.rs         Serializable application errors
    └── lib.rs           Tauri lifecycle and command registration
```

See [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), and [MIGRATIONS.md](MIGRATIONS.md) for implementation details.

## Privacy

There is no account, analytics SDK, or application server. The SQLite database lives in the platform application-data directory. Data leaves the device only through an export or backup action the user configures.
