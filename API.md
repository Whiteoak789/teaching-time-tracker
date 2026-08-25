# Tauri command API

Frontend wrappers live in `src/api/tauri.ts`. Commands return serializable validation or database errors.

| Command | Input | Result | Purpose |
|---|---|---|---|
| `get_app_snapshot` | — | `AppSnapshot` | Load semesters, categories, entries, notes, reminders, backups, settings |
| `save_semester` | `SemesterInput` | `AppSnapshot` | Create/update semester and normalized school |
| `save_category` | `CategoryInput` | `AppSnapshot` | Create/update category behavior and presentation |
| `save_time_entry` | `TimeEntryInput` | `AppSnapshot` | Validate and transactionally upsert time |
| `delete_time_entry` | ID + confirmation | `AppSnapshot` | Soft-delete time |
| `duplicate_time_entry` | ID + target date | `AppSnapshot` | Copy an entry without verification |
| `bulk_verify` | IDs + verifier | `AppSnapshot` | Verify eligible entries in one transaction |
| `save_note` / `delete_note` | Note input / ID | `AppSnapshot` | Maintain linked and pinned notes |
| `save_reminder` / `delete_reminder` | Reminder input / ID | `AppSnapshot` | Maintain local notification rules |
| `save_settings` | `AppSettings` | `AppSnapshot` | Persist local preferences |
| `export_data` | format + semester | text | Produce CSV or JSON |
| `create_backup` | destination + optional password | `BackupRecord` | Build, package, encrypt, checksum, and record snapshot |
| `restore_backup` | path + optional password + confirmation | `AppSnapshot` | Validate, safety-backup, and restore |

Example:

```ts
const updated = await invoke<AppSnapshot>("save_time_entry", {
  input: {
    semester_id: "semester-id",
    category_id: "teaching-id",
    entry_date: "2027-01-11",
    duration_minutes: 390,
    counts_clinical: true,
    counts_pd: false
  }
});
```

Invalid dates, negative durations, reversed time ranges, out-of-semester dates, unknown relations, unconfirmed destructive requests, and malformed backups are rejected.
