import { useMemo, useState } from "react";
import { CalendarClock, FileText, Search, StickyNote } from "lucide-react";
import { Modal, Pill } from "./ui";
import { useAppStore } from "@/stores/appStore";
import { useNavigate } from "react-router-dom";

export function GlobalSearch() {
  const { data, searchOpen, setSearchOpen, openEntryModal, setSelectedDate } = useAppStore();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const results = useMemo(() => {
    if (!data || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    const categoryById = new Map(data.categories.map((item) => [item.id, item.name]));
    return [
      ...data.entries.filter((item) => [item.description, item.notes, item.location, item.teacher, categoryById.get(item.category_id)].some((value) => value?.toLowerCase().includes(q))).map((item) => ({ id: item.id, kind: "Time entry", title: item.description || categoryById.get(item.category_id) || "Time entry", detail: `${item.entry_date} · ${item.location || "No location"}`, icon: CalendarClock, action: () => { setSelectedDate(item.entry_date); navigate("/"); openEntryModal(item.id); } })),
      ...data.notes.filter((item) => [item.title, item.body, item.tags].some((value) => value.toLowerCase().includes(q))).map((item) => ({ id: item.id, kind: "Note", title: item.title, detail: item.body.slice(0, 80), icon: StickyNote, action: () => navigate("/notes") })),
      ...data.semesters.filter((item) => [item.name, item.school, item.cooperating_teacher, item.university_supervisor].some((value) => value.toLowerCase().includes(q))).map((item) => ({ id: item.id, kind: "Semester", title: item.name, detail: item.school, icon: FileText, action: () => navigate("/settings") })),
    ].slice(0, 12);
  }, [data, query, navigate, openEntryModal, setSelectedDate]);
  return <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search Teaching Time Tracker" className="search-modal"><div className="global-search-input"><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Notes, entries, schools, teachers…" /></div><div className="search-results">{query.length < 2 ? <p className="search-hint">Type at least two characters to search your local data.</p> : results.length ? results.map((result) => <button key={`${result.kind}-${result.id}`} onClick={() => { result.action(); setSearchOpen(false); setQuery(""); }}><span className="result-icon"><result.icon /></span><span><strong>{result.title}</strong><small>{result.detail}</small></span><Pill>{result.kind}</Pill></button>) : <p className="search-hint">No matching entries or notes.</p>}</div></Modal>;
}

export function ShortcutHelp() {
  const { shortcutsOpen, setShortcutsOpen } = useAppStore();
  const shortcuts = [["New time entry", "⌘/Ctrl N"], ["Search", "⌘/Ctrl K"], ["Settings", "⌘/Ctrl ,"], ["Backup now", "⌘/Ctrl B"], ["Close dialog", "Esc"], ["Shortcut help", "?"]];
  return <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Keyboard shortcuts" subtitle="Move quickly without leaving the keyboard." className="shortcut-modal"><div className="shortcut-list">{shortcuts.map(([label, keys]) => <div key={label}><span>{label}</span><kbd>{keys}</kbd></div>)}</div></Modal>;
}
