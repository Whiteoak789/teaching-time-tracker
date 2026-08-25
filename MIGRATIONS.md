# Database migrations

Migrations are append-only entries in `src-tauri/src/db/migrations.rs`. Startup creates `_migrations`, reads the latest applied version, and applies each newer migration inside a transaction.

The first migration creates normalized tables for settings, schools, supervisors, semesters, categories, requirements, time entries, daily overrides, notes, weekly verifications, backup destinations/history, reminders, and attachments. Foreign keys, date/range checks, duration checks, soft-deletion fields, and query indexes enforce integrity close to the data.

To change the schema:

1. Add a new `Migration` with the next sequential version.
2. Never alter SQL that may already have run on a user's device.
3. Include required indexes and migration-safe defaults.
4. Update Rust models, row mappers, TypeScript types, and IPC wrappers.
5. Verify against both a new database and one stopped at the previous version.

Production migrations move forward. Development rollback should be performed only on disposable data.
