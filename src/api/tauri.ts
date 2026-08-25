import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, AppSnapshot, BackupRecord, CategoryInput, NoteInput, ReminderInput, SemesterInput, TimeEntryInput } from "@/types";

const STORAGE_KEY = "teaching-time-tracker-browser-data";
const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const stamp = () => new Date().toISOString();

const defaultCategories = [
  ["Teaching", "TEA", "#6f8edb", "BookOpen", true, false, false, false],
  ["Professional Development", "PD", "#72b69a", "GraduationCap", false, true, false, false],
  ["Subbing", "SUB", "#7cb7d8", "Users", true, false, false, false],
  ["Courses / Breaks", "CRS", "#e8aa63", "Coffee", false, false, false, false],
  ["Meetings", "MTG", "#a28ac7", "MessagesSquare", false, false, false, false],
  ["Planning", "PLN", "#55a9a3", "ClipboardList", false, false, false, false],
  ["Grading", "GRD", "#df7f78", "CheckSquare", false, false, false, false],
  ["Observation", "OBS", "#7176bc", "Eye", true, false, false, false],
  ["Absence", "ABS", "#cf6467", "CircleAlert", false, false, true, false],
  ["School Closure", "CLS", "#969ba5", "School", false, false, false, true],
  ["Other", "OTH", "#7e899b", "MoreHorizontal", false, false, false, false],
] as const;

function emptySnapshot(): AppSnapshot {
  return {
    semesters: [], entries: [], notes: [], reminders: [], backups: [], settings: { theme: "system", week_starts_on: "sunday", clock_format: "12", default_duration: 60, automatic_backup: false, backup_frequency: "weekly", backup_retention_count: 10, backup_on_close: false },
    categories: defaultCategories.map((item, sort_order) => ({ id: crypto.randomUUID(), name: item[0], abbreviation: item[1], color: item[2], icon: item[3], counts_clinical: item[4], counts_pd: item[5], is_absence: item[6], is_closure: item[7], active: true, sort_order, created_at: stamp(), updated_at: stamp() })),
  };
}

function readMock(): AppSnapshot {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) as AppSnapshot : emptySnapshot();
}

function writeMock(snapshot: AppSnapshot): AppSnapshot {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

function mockUpsert<T extends { id?: string }>(collection: keyof Pick<AppSnapshot, "semesters" | "categories" | "entries" | "notes" | "reminders">, input: T): AppSnapshot {
  const snapshot = readMock();
  const list = snapshot[collection] as unknown as Array<Record<string, unknown>>;
  const existingIndex = list.findIndex((item) => item.id === input.id);
  const record = { ...input, id: input.id ?? crypto.randomUUID(), created_at: existingIndex >= 0 ? list[existingIndex].created_at : stamp(), updated_at: stamp() } as Record<string, unknown>;
  if (existingIndex >= 0) list[existingIndex] = record; else list.push(record);
  return writeMock(snapshot);
}

export async function getAppSnapshot() { return isTauri() ? invoke<AppSnapshot>("get_app_snapshot") : readMock(); }
export async function saveSemester(input: SemesterInput) { return isTauri() ? invoke<AppSnapshot>("save_semester", { input }) : mockUpsert("semesters", input); }
export async function saveCategory(input: CategoryInput) { return isTauri() ? invoke<AppSnapshot>("save_category", { input }) : mockUpsert("categories", input); }
export async function saveTimeEntry(input: TimeEntryInput) { return isTauri() ? invoke<AppSnapshot>("save_time_entry", { input }) : mockUpsert("entries", input); }
export async function saveNote(input: NoteInput) { return isTauri() ? invoke<AppSnapshot>("save_note", { input }) : mockUpsert("notes", input); }
export async function saveReminder(input: ReminderInput) { return isTauri() ? invoke<AppSnapshot>("save_reminder", { input }) : mockUpsert("reminders", input); }

function mockDelete(collection: "entries" | "notes" | "reminders", id: string) {
  const snapshot = readMock();
  (snapshot[collection] as Array<{ id: string }>).splice((snapshot[collection] as Array<{ id: string }>).findIndex((item) => item.id === id), 1);
  return writeMock(snapshot);
}

export async function deleteTimeEntry(id: string) { return isTauri() ? invoke<AppSnapshot>("delete_time_entry", { id, confirmed: true }) : mockDelete("entries", id); }
export async function deleteNote(id: string) { return isTauri() ? invoke<AppSnapshot>("delete_note", { id, confirmed: true }) : mockDelete("notes", id); }
export async function deleteReminder(id: string) { return isTauri() ? invoke<AppSnapshot>("delete_reminder", { id, confirmed: true }) : mockDelete("reminders", id); }
export async function saveSettings(settings: AppSettings) { if (isTauri()) return invoke<AppSnapshot>("save_settings", { settings }); const snapshot = readMock(); snapshot.settings = settings; return writeMock(snapshot); }
export async function duplicateTimeEntry(id: string, entryDate: string) { if (isTauri()) return invoke<AppSnapshot>("duplicate_time_entry", { id, entryDate }); const source = readMock().entries.find((entry) => entry.id === id); if (!source) throw new Error("Entry not found"); return mockUpsert("entries", { ...source, id: undefined, entry_date: entryDate, verified: false, verified_date: null }); }
export async function bulkVerify(ids: string[], verifierName: string) { if (isTauri()) return invoke<AppSnapshot>("bulk_verify", { ids, verifierName }); const snapshot = readMock(); snapshot.entries = snapshot.entries.map((entry) => ids.includes(entry.id) ? { ...entry, verified: true, verified_date: new Date().toISOString().slice(0, 10), verifier_name: verifierName } : entry); return writeMock(snapshot); }
export async function exportData(format: "csv" | "json", semesterId?: string) { if (isTauri()) return invoke<string>("export_data", { format, semesterId }); const snapshot = readMock(); return format === "json" ? JSON.stringify(snapshot, null, 2) : ["date,category,duration_minutes,description", ...snapshot.entries.filter((entry) => !semesterId || entry.semester_id === semesterId).map((entry) => `${entry.entry_date},${entry.category_id},${entry.duration_minutes},\"${entry.description.replaceAll('"', '""')}\"`)].join("\n"); }
export async function createBackup(destination?: string, password?: string) { if (isTauri()) return invoke<BackupRecord>("create_backup", { request: { destination, password } }); const snapshot = readMock(); const record: BackupRecord = { id: crypto.randomUUID(), destination: destination ?? "Browser downloads", file_path: "Teaching-Time-Tracker.teachingtracker", checksum: "browser-preview", device_id: "browser", backup_version: 1, size_bytes: JSON.stringify(snapshot).length, encrypted: Boolean(password), status: "success", error: null, created_at: stamp() }; snapshot.backups.unshift(record); writeMock(snapshot); return record; }
export async function restoreBackup(filePath: string, password?: string) { return invoke<AppSnapshot>("restore_backup", { request: { file_path: filePath, password, confirmed: true } }); }
export { isTauri };
