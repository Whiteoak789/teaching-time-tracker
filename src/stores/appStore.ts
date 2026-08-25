import { create } from "zustand";
import type { AppSettings, AppSnapshot, CategoryInput, NoteInput, ReminderInput, SemesterInput, TimeEntryInput } from "@/types";
import * as api from "@/api/tauri";

interface AppState {
  data: AppSnapshot | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  selectedDate: string;
  entryModalOpen: boolean;
  editingEntryId: string | null;
  searchOpen: boolean;
  shortcutsOpen: boolean;
  initialize: () => Promise<void>;
  apply: (operation: () => Promise<AppSnapshot>) => Promise<void>;
  saveSemester: (input: SemesterInput) => Promise<void>;
  saveCategory: (input: CategoryInput) => Promise<void>;
  saveEntry: (input: TimeEntryInput) => Promise<void>;
  saveNote: (input: NoteInput) => Promise<void>;
  saveReminder: (input: ReminderInput) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  setSelectedDate: (date: string) => void;
  openEntryModal: (id?: string) => void;
  closeEntryModal: () => void;
  setSearchOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setData: (data: AppSnapshot) => void;
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  data: null, loading: true, saving: false, error: null,
  selectedDate: new Date().toISOString().slice(0, 10), entryModalOpen: false, editingEntryId: null, searchOpen: false, shortcutsOpen: false,
  initialize: async () => { try { set({ loading: true, error: null, data: await api.getAppSnapshot() }); } catch (error) { set({ error: String(error) }); } finally { set({ loading: false }); } },
  apply: async (operation) => { try { set({ saving: true, error: null }); set({ data: await operation() }); } catch (error) { set({ error: String(error) }); throw error; } finally { set({ saving: false }); } },
  saveSemester: (input) => get().apply(() => api.saveSemester(input)),
  saveCategory: (input) => get().apply(() => api.saveCategory(input)),
  saveEntry: async (input) => { await get().apply(() => api.saveTimeEntry(input)); set({ entryModalOpen: false, editingEntryId: null }); },
  saveNote: (input) => get().apply(() => api.saveNote(input)),
  saveReminder: (input) => get().apply(() => api.saveReminder(input)),
  saveSettings: (settings) => get().apply(() => api.saveSettings(settings)),
  deleteEntry: (id) => get().apply(() => api.deleteTimeEntry(id)),
  deleteNote: (id) => get().apply(() => api.deleteNote(id)),
  deleteReminder: (id) => get().apply(() => api.deleteReminder(id)),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  openEntryModal: (editingEntryId) => set({ entryModalOpen: true, editingEntryId: editingEntryId ?? null }),
  closeEntryModal: () => set({ entryModalOpen: false, editingEntryId: null }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setData: (data) => set({ data }),
  clearError: () => set({ error: null }),
}));
