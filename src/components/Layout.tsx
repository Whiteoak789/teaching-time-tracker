import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ArchiveRestore, Bell, CalendarDays, ChartNoAxesCombined, ClipboardCheck, FileBarChart,
  FolderSync, Goal, Grid2X2, Menu, NotebookPen, Plus, Search, Settings, Sparkles,
} from "lucide-react";
import { Button, Pill } from "./ui";
import { useAppStore } from "@/stores/appStore";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useState } from "react";

const navigation = [
  ["Calendar", "/", CalendarDays], ["Timesheet", "/timesheet", ClipboardCheck], ["Summary", "/summary", ChartNoAxesCombined],
  ["Notes", "/notes", NotebookPen], ["Goals / Requirements", "/goals", Goal], ["Reports", "/reports", FileBarChart],
  ["Categories", "/categories", Grid2X2], ["Reminders", "/reminders", Bell], ["Backup & Sync", "/backup", FolderSync],
  ["Settings", "/settings", Settings],
] as const;

export default function Layout() {
  const { data, openEntryModal, setSearchOpen, saveSettings } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  if (!data) return null;
  const activeSemester = data.semesters.find((semester) => semester.id === data.settings.active_semester_id) ?? data.semesters[0];
  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}><aside className="app-sidebar"><div className="sidebar-top"><button className="app-logo" onClick={() => navigate("/")} aria-label="Go to calendar"><span><Sparkles size={18} /></span><strong>Teaching<br />Time Tracker</strong></button><Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar"><Menu size={19} /></Button></div><nav aria-label="Main navigation">{navigation.map(([label, path, Icon]) => <NavLink key={path} to={path} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} title={label}><Icon size={18} /><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><div className="semester-block"><small>Current semester</small><select value={activeSemester.id} onChange={(event) => saveSettings({ ...data.settings, active_semester_id: event.target.value })}>{data.semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}</select></div><div className="backup-state"><span className="status-dot" /><div><strong>Local & private</strong><small>{data.settings.last_backup_at ? `Backed up ${formatDistanceToNow(parseISO(data.settings.last_backup_at), { addSuffix: true })}` : "Not backed up yet"}</small></div></div></div></aside><main className="main-column"><header className="topbar"><div className="topbar-title"><button className="mobile-menu" onClick={() => setCollapsed(!collapsed)}><Menu /></button><span>{activeSemester.name}</span><Pill tone="blue">Active</Pill></div><div className="topbar-actions"><button className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={17} /><span>Search anything</span><kbd>⌘ K</kbd></button><Button onClick={() => openEntryModal()}><Plus size={17} /> Add time</Button></div></header><div className="page-scroll"><Outlet /></div></main></div>;
}
