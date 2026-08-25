import { useEffect } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Onboarding from "@/components/Onboarding";
import EntryForm from "@/components/EntryForm";
import { GlobalSearch, ShortcutHelp } from "@/components/GlobalDialogs";
import CalendarPage from "@/pages/CalendarPage";
import { BackupPage, CategoriesPage, GoalsPage, NotesPage, RemindersPage, ReportsPage, SettingsPage, SummaryPage, TimesheetPage } from "@/pages/Pages";
import { useAppStore } from "@/stores/appStore";
import { CalendarDays, X } from "lucide-react";

export default function App() {
  const { data, loading, error, initialize, clearError, openEntryModal, setSearchOpen, setShortcutsOpen, closeEntryModal } = useAppStore();
  const navigate = useNavigate();
  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "n") { event.preventDefault(); openEntryModal(); }
      if (meta && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (meta && event.key === ",") { event.preventDefault(); navigate("/settings"); }
      if (meta && event.key.toLowerCase() === "b") { event.preventDefault(); navigate("/backup"); }
      if (event.key === "Escape") { closeEntryModal(); setSearchOpen(false); setShortcutsOpen(false); }
      if (event.key === "?" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) setShortcutsOpen(true);
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [closeEntryModal, navigate, openEntryModal, setSearchOpen, setShortcutsOpen]);
  useEffect(() => {
    if (!data) return;
    const theme = data.settings.theme ?? "system";
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, [data?.settings.theme]);

  if (loading) return <div className="loading-screen"><span><CalendarDays /></span><h1>Teaching Time Tracker</h1><div className="loading-bar" /></div>;
  if (!data) return <div className="fatal-error"><h1>Teaching Time Tracker couldn’t open</h1><p>{error}</p><button onClick={() => initialize()}>Try again</button></div>;
  if (!data.semesters.length) return <><Onboarding />{error && <ErrorToast message={error} onClose={clearError} />}</>;
  return <><Routes><Route element={<Layout />}><Route index element={<CalendarPage />} /><Route path="timesheet" element={<TimesheetPage />} /><Route path="summary" element={<SummaryPage />} /><Route path="notes" element={<NotesPage />} /><Route path="goals" element={<GoalsPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="categories" element={<CategoriesPage />} /><Route path="reminders" element={<RemindersPage />} /><Route path="backup" element={<BackupPage />} /><Route path="settings" element={<SettingsPage />} /></Route></Routes><EntryForm /><GlobalSearch /><ShortcutHelp />{error && <ErrorToast message={error} onClose={clearError} />}</>;
}

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="error-toast" role="alert"><div><strong>Something needs attention</strong><span>{message.replace(/^Error:\s*/, "")}</span></div><button onClick={onClose}><X /></button></div>;
}
