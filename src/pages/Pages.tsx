import { useMemo, useState } from "react";
import {
  addDays,
  endOfWeek,
  format,
  formatDistanceToNow,
  parseISO,
  startOfWeek,
} from "date-fns";
import {
  Archive,
  Bell,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Cloud,
  Download,
  Edit3,
  FileJson,
  FileSpreadsheet,
  FileText,
  Folder,
  Goal,
  HardDrive,
  KeyRound,
  LockKeyhole,
  MoreHorizontal,
  NotebookPen,
  PackageCheck,
  Palette,
  Plus,
  Printer,
  Save,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  WifiOff,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Pill,
  ProgressBar,
  Toggle,
} from "@/components/ui";
import { CategoryIcon } from "@/components/icons";
import {
  calculateDailyTotals,
  calculateSemesterProgress,
  calculateWeeklyTotals,
} from "@/lib/calculations";
import { formatHours } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import {
  bulkVerify,
  createBackup,
  exportData,
  isTauri,
  restoreBackup,
} from "@/api/tauri";
import type {
  AppSettings,
  Category,
  CategoryInput,
  Note,
  NoteInput,
  ReminderInput,
  SemesterInput,
  TimeEntry,
} from "@/types";

function useActiveData() {
  const data = useAppStore((state) => state.data)!;
  const semester =
    data.semesters.find(
      (item) => item.id === data.settings.active_semester_id,
    ) ?? data.semesters[0];
  const entries = data.entries.filter(
    (entry) => entry.semester_id === semester.id,
  );
  return { data, semester, entries };
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function TimesheetPage() {
  const { data, semester, entries } = useActiveData();
  const weeks = calculateWeeklyTotals(
    entries,
    data.categories,
    semester,
    data.settings.week_starts_on === "monday" ? 1 : 0,
  );
  const [expanded, setExpanded] = useState<string | null>(
    weeks[0]?.weekStart ?? null,
  );
  const categoryById = new Map(
    data.categories.map((category) => [category.id, category]),
  );
  return (
    <div className="standard-page">
      <PageHeading
        eyebrow="Weekly tracking"
        title="Timesheet"
        description="A traditional week-by-week view of your clinical practice."
        action={
          <Button onClick={() => window.print()}>
            <Printer size={17} /> Print timesheet
          </Button>
        }
      />
      <div className="summary-strip">
        <SummaryMini label="Weeks logged" value={String(weeks.length)} />
        <SummaryMini
          label="Clinical days"
          value={weeks
            .reduce((sum, week) => sum + week.clinicalDays, 0)
            .toFixed(1)}
        />
        <SummaryMini
          label="PD time"
          value={`${weeks.reduce((sum, week) => sum + week.pdHours, 0).toFixed(1)} hr`}
        />
        <SummaryMini
          label="Needs verification"
          value={String(
            entries.filter(
              (entry) => entry.verification_required && !entry.verified,
            ).length,
          )}
        />
      </div>
      <div className="timesheet-list">
        {weeks.map((week, index) => {
          const isOpen = expanded === week.weekStart;
          const weekDays = Array.from({ length: 7 }, (_, offset) =>
            format(addDays(parseISO(week.weekStart), offset), "yyyy-MM-dd"),
          );
          return (
            <section className="timesheet-week" key={week.weekStart}>
              <button
                className="week-header"
                onClick={() => setExpanded(isOpen ? null : week.weekStart)}
              >
                {isOpen ? <ChevronDown /> : <ChevronRight />}
                <span className="week-number">
                  <small>WEEK</small>
                  <strong>{weeks.length - index}</strong>
                </span>
                <span className="week-range">
                  <strong>
                    {format(parseISO(week.weekStart), "MMM d")} –{" "}
                    {format(endOfWeek(parseISO(week.weekStart)), "MMM d, yyyy")}
                  </strong>
                  <small>{week.days.length} days with recorded activity</small>
                </span>
                <span className="week-metric">
                  <small>Clinical</small>
                  <strong>{week.clinicalDays}</strong>
                </span>
                <span className="week-metric">
                  <small>PD time</small>
                  <strong>{week.pdHours.toFixed(1)} hr</strong>
                </span>
                <Pill
                  tone={
                    week.verification === "needed"
                      ? "amber"
                      : week.verification === "verified"
                        ? "green"
                        : "neutral"
                  }
                >
                  {week.verification === "needed"
                    ? "Needs verification"
                    : week.verification === "verified"
                      ? "Verified"
                      : "Complete"}
                </Pill>
              </button>
              {isOpen && (
                <div className="week-details">
                  <div className="week-day-grid">
                    {weekDays.map((date) => {
                      const day = week.days.find((item) => item.date === date);
                      return (
                        <div className="week-day" key={date}>
                          <header>
                            <span>{format(parseISO(date), "EEE")}</span>
                            <strong>{format(parseISO(date), "d")}</strong>
                          </header>
                          {day ? (
                            <>
                              <b>{day.hours.toFixed(1)} hr</b>
                              <small>{day.credit} clinical day</small>
                              {day.entries.map((entry) => (
                                <div className="week-entry" key={entry.id}>
                                  <i
                                    style={{
                                      background: categoryById.get(
                                        entry.category_id,
                                      )?.color,
                                    }}
                                  />
                                  {
                                    categoryById.get(entry.category_id)
                                      ?.abbreviation
                                  }
                                  <span>
                                    {formatHours(entry.duration_minutes)}
                                  </span>
                                </div>
                              ))}
                            </>
                          ) : (
                            <em>—</em>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <footer>
                    <span>
                      Regular days <strong>{week.clinicalDays}</strong>
                    </span>
                    <span>
                      PD <strong>{week.pdHours.toFixed(1)} hr</strong>
                    </span>
                    <span>
                      Absences <strong>{week.absences}</strong>
                    </span>
                    <span>
                      Closures <strong>{week.closures}</strong>
                    </span>
                  </footer>
                </div>
              )}
            </section>
          );
        })}
        {!weeks.length && (
          <EmptyState
            icon={<Clock3 />}
            title="Your timesheet is ready"
            body="Add your first time entry and its week will appear here automatically."
          />
        )}
      </div>
    </div>
  );
}

export function SummaryPage() {
  const { data, semester, entries } = useActiveData();
  const progress = calculateSemesterProgress(
    entries,
    data.categories,
    semester,
  );
  const weeks = calculateWeeklyTotals(
    entries,
    data.categories,
    semester,
    data.settings.week_starts_on === "monday" ? 1 : 0,
  ).reverse();
  const daily = calculateDailyTotals(entries, data.categories, semester);
  const categoryData = data.categories
    .map((category) => ({
      name: category.abbreviation,
      fullName: category.name,
      value: entries
        .filter((entry) => entry.category_id === category.id)
        .reduce((sum, entry) => sum + entry.duration_minutes / 60, 0),
      color: category.color,
    }))
    .filter((row) => row.value > 0);
  const monthMap = new Map<string, number>();
  daily.forEach((day) =>
    monthMap.set(
      format(parseISO(day.date), "MMM"),
      (monthMap.get(format(parseISO(day.date), "MMM")) ?? 0) + day.credit,
    ),
  );
  return (
    <div className="standard-page">
      <PageHeading
        eyebrow="At a glance"
        title="Semester summary"
        description={`${semester.name} · ${format(parseISO(semester.start_date), "MMMM d")} to ${format(parseISO(semester.end_date), "MMMM d, yyyy")}`}
      />
      <div className="hero-progress">
        <div>
          <span className="hero-icon">
            <Goal />
          </span>
          <div>
            <small>Clinical progress</small>
            <h2>
              {progress.clinicalDays} <em>/ {progress.requiredDays} days</em>
            </h2>
            <p>{progress.remainingDays} days remaining</p>
          </div>
        </div>
        <div
          className="progress-ring"
          style={
            {
              "--percent": `${progress.percent * 3.6}deg`,
            } as React.CSSProperties
          }
        >
          <strong>{progress.percent}%</strong>
          <span>complete</span>
        </div>
        <div className="hero-progress-bar">
          <ProgressBar value={progress.percent} />
          <span>
            Projected completion:{" "}
            <strong>
              {progress.projectedCompletion
                ? format(parseISO(progress.projectedCompletion), "MMM d, yyyy")
                : "Add more time to calculate"}
            </strong>
          </span>
        </div>
      </div>
      <div className="metric-grid">
        <MetricCard
          label="Semester hours"
          value={progress.semesterHours.toFixed(1)}
          suffix="hrs"
          icon={<Clock3 />}
          tone="blue"
        />
        <MetricCard
          label="PD hours"
          value={progress.pdHours.toFixed(1)}
          suffix={
            semester.required_pd_hours
              ? `/ ${semester.required_pd_hours}`
              : "hrs"
          }
          icon={<Sparkles />}
          tone="green"
        />
        <MetricCard
          label="Average / day"
          value={progress.averageHoursPerDay.toFixed(1)}
          suffix="hrs"
          icon={<CalendarCheck />}
          tone="purple"
        />
        <MetricCard
          label="Awaiting verification"
          value={String(progress.unverified)}
          suffix="entries"
          icon={<ShieldCheck />}
          tone="amber"
        />
        <MetricCard
          label="Absences"
          value={String(progress.absences)}
          suffix="days"
          icon={<CircleAlert />}
          tone="red"
        />
        <MetricCard
          label="School closures"
          value={String(progress.closures)}
          suffix="days"
          icon={<School />}
          tone="gray"
        />
      </div>
      <div className="chart-grid">
        <section className="chart-card wide">
          <header>
            <div>
              <h3>Hours by week</h3>
              <p>Your teaching activity across the semester</p>
            </div>
          </header>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={weeks.map((week) => ({
                  week: format(parseISO(week.weekStart), "MMM d"),
                  hours: week.hours,
                }))}
              >
                <CartesianGrid vertical={false} stroke="#e9eaf0" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f6f7fa" }} />
                <Bar dataKey="hours" fill="#6f8edb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="chart-card">
          <header>
            <div>
              <h3>Hours by category</h3>
              <p>Where your time goes</p>
            </div>
          </header>
          <div className="chart-body donut-chart">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {categoryData.map((row) => (
                    <Cell key={row.name} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {categoryData.slice(0, 5).map((row) => (
                <span key={row.name}>
                  <i style={{ background: row.color }} />
                  {row.fullName}
                  <strong>{row.value.toFixed(1)}h</strong>
                </span>
              ))}
            </div>
          </div>
        </section>
        <section className="chart-card wide">
          <header>
            <div>
              <h3>Clinical days by month</h3>
              <p>Credited days earned each month</p>
            </div>
          </header>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[...monthMap].map(([month, days]) => ({ month, days }))}
              >
                <CartesianGrid vertical={false} stroke="#e9eaf0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="days" fill="#72b69a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

export function NotesPage() {
  const { data, semester } = useActiveData();
  const { saveNote, deleteNote } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(
    data.notes[0]?.id ?? null,
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<NoteInput | null>(null);
  const notes = data.notes
    .filter((note) => !note.semester_id || note.semester_id === semester.id)
    .filter((note) =>
      `${note.title} ${note.body} ${note.tags}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const selected = notes.find((note) => note.id === selectedId);
  const startDraft = (note?: Note) =>
    setDraft(
      note
        ? { ...note }
        : {
            title: "",
            body: "",
            pinned: false,
            linked_date: null,
            semester_id: semester.id,
            time_entry_id: null,
            tags: "",
          },
    );
  return (
    <div className="notes-page">
      <aside className="notes-list">
        <div className="notes-list-header">
          <div>
            <span className="eyebrow">Notebook</span>
            <h1>Notes</h1>
          </div>
          <Button size="icon" onClick={() => startDraft()}>
            <Plus />
          </Button>
        </div>
        <div className="notes-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
          />
        </div>
        <div className="notes-scroll">
          {notes.map((note) => (
            <button
              key={note.id}
              className={selected?.id === note.id ? "active" : ""}
              onClick={() => setSelectedId(note.id)}
            >
              <div>
                <strong>{note.title}</strong>
                {note.pinned && <Sparkles size={13} />}
              </div>
              <p>{note.body || "Empty note"}</p>
              <small>
                {formatDistanceToNow(parseISO(note.updated_at), {
                  addSuffix: true,
                })}
                {note.tags && ` · ${note.tags}`}
              </small>
            </button>
          ))}
        </div>
      </aside>
      <section className="note-editor">
        {selected ? (
          <>
            <header>
              <div>
                <Pill tone={selected.pinned ? "blue" : "neutral"}>
                  {selected.pinned ? "Pinned" : "Note"}
                </Pill>
                <span>
                  Updated{" "}
                  {formatDistanceToNow(parseISO(selected.updated_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <div>
                <Button variant="ghost" onClick={() => startDraft(selected)}>
                  <Edit3 size={17} /> Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    if (confirm("Delete this note?")) {
                      await deleteNote(selected.id);
                      setSelectedId(null);
                    }
                  }}
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            </header>
            <article>
              <h1>{selected.title}</h1>
              {selected.tags && (
                <div className="note-tags">
                  {selected.tags.split(",").map((tag) => (
                    <Pill key={tag}>#{tag.trim()}</Pill>
                  ))}
                </div>
              )}
              <p>{selected.body}</p>
              {selected.linked_date && (
                <div className="note-link">
                  <CalendarCheck /> Linked to{" "}
                  {format(parseISO(selected.linked_date), "MMMM d, yyyy")}
                </div>
              )}
            </article>
          </>
        ) : (
          <EmptyState
            icon={<NotebookPen />}
            title="Select a note"
            body="Choose a note from the left, or make a new one."
            action={
              <Button onClick={() => startDraft()}>
                <Plus /> New note
              </Button>
            }
          />
        )}
      </section>
      <NoteModal
        draft={draft}
        close={() => setDraft(null)}
        save={async (value) => {
          await saveNote(value);
          setDraft(null);
        }}
      />
    </div>
  );
}

function NoteModal({
  draft,
  close,
  save,
}: {
  draft: NoteInput | null;
  close: () => void;
  save: (note: NoteInput) => Promise<void>;
}) {
  const [value, setValue] = useState<NoteInput | null>(null);
  const current = value?.id === draft?.id ? value : draft;
  if (!current) return null;
  const update = (patch: Partial<NoteInput>) =>
    setValue({ ...current, ...patch });
  return (
    <Modal
      open
      title={draft?.id ? "Edit note" : "New note"}
      onClose={close}
      className="note-modal"
    >
      <div className="form-grid modal-form">
        <Field label="Title" wide>
          <Input
            autoFocus
            value={current.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </Field>
        <Field label="Note" wide>
          <textarea
            className="input textarea tall"
            value={current.body}
            onChange={(e) => update({ body: e.target.value })}
          />
        </Field>
        <Field label="Linked date">
          <Input
            type="date"
            value={current.linked_date ?? ""}
            onChange={(e) => update({ linked_date: e.target.value || null })}
          />
        </Field>
        <Field label="Tags">
          <Input
            placeholder="verification, reflection"
            value={current.tags}
            onChange={(e) => update({ tags: e.target.value })}
          />
        </Field>
        <div className="field-wide">
          <Toggle
            checked={current.pinned}
            onChange={(pinned) => update({ pinned })}
            label="Pin this note"
            description="Show it in the calendar sidebar"
          />
        </div>
      </div>
      <footer className="modal-actions">
        <span />
        <div>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={() => save(current)}
            disabled={!current.title.trim()}
          >
            <Save size={16} /> Save note
          </Button>
        </div>
      </footer>
    </Modal>
  );
}

export function GoalsPage() {
  const { data, semester, entries } = useActiveData();
  const progress = calculateSemesterProgress(
    entries,
    data.categories,
    semester,
  );
  const [editing, setEditing] = useState(false);
  return (
    <div className="standard-page">
      <PageHeading
        eyebrow="Requirements"
        title="Goals & requirements"
        description="See exactly what remains and tune the rules that determine credit."
        action={
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Edit3 size={17} /> Edit requirements
          </Button>
        }
      />
      <div className="goal-grid">
        <section className="goal-card primary-goal">
          <span>
            <Goal />
          </span>
          <div>
            <small>Clinical days</small>
            <h2>
              {progress.clinicalDays}
              <em> / {semester.required_clinical_days}</em>
            </h2>
            <ProgressBar value={progress.percent} />
            <p>
              <strong>{progress.remainingDays} days remaining</strong>
              <span>{progress.percent}% completed</span>
            </p>
          </div>
        </section>
        <section className="goal-card">
          <span className="green">
            <Sparkles />
          </span>
          <div>
            <small>Professional development</small>
            <h2>
              {progress.pdHours.toFixed(1)}
              <em>
                {" "}
                / {semester.required_pd_hours || "No goal"}{" "}
                {semester.required_pd_hours ? "hrs" : ""}
              </em>
            </h2>
            <ProgressBar
              value={
                semester.required_pd_hours
                  ? (progress.pdHours / semester.required_pd_hours) * 100
                  : 0
              }
              color="#72b69a"
            />
            <p>
              <strong>
                {semester.required_pd_hours
                  ? `${Math.max(0, semester.required_pd_hours - progress.pdHours).toFixed(1)} hours remaining`
                  : "Optional tracking"}
              </strong>
            </p>
          </div>
        </section>
      </div>
      <section className="rules-card">
        <header>
          <div>
            <h2>How a day earns credit</h2>
            <p>
              These rules apply to combined eligible time on each calendar date.
            </p>
          </div>
        </header>
        <div className="rule-flow">
          <div>
            <span>0 – &lt;{semester.half_day_threshold} hr</span>
            <strong>
              {semester.partial_hours_accumulate
                ? "Partial credit"
                : "No day credit"}
            </strong>
            <small>
              {semester.partial_hours_accumulate
                ? "Hours accumulate proportionally"
                : "Time remains in your hour totals"}
            </small>
          </div>
          <ChevronRight />
          <div>
            <span>
              {semester.half_day_threshold} – &lt;{semester.full_day_threshold}{" "}
              hr
            </span>
            <strong>½ clinical day</strong>
            <small>At least the half-day threshold</small>
          </div>
          <ChevronRight />
          <div>
            <span>{semester.full_day_threshold}+ hr</span>
            <strong>1 clinical day</strong>
            <small>At or above the full-day threshold</small>
          </div>
        </div>
        <div className="rule-list">
          <div>
            <Check /> Teaching and observation count by category
          </div>
          <div>
            {semester.pd_counts_clinical ? <Check /> : <MoreHorizontal />} PD{" "}
            {semester.pd_counts_clinical ? "counts" : "does not count"} toward
            clinical days
          </div>
          <div>
            {semester.subbing_counts ? <Check /> : <MoreHorizontal />} Subbing{" "}
            {semester.subbing_counts ? "counts" : "does not count"}
          </div>
          <div>
            <Check /> Manual entry overrides take precedence
          </div>
        </div>
      </section>
      <SemesterModal
        semester={editing ? semester : null}
        close={() => setEditing(false)}
      />
    </div>
  );
}

export function ReportsPage() {
  const { data, semester, entries } = useActiveData();
  const [report, setReport] = useState("Detailed Time Log");
  const [verification, setVerification] = useState("all");
  const [category, setCategory] = useState("all");
  const [exporting, setExporting] = useState(false);
  const filtered = entries.filter(
    (entry) =>
      (category === "all" || entry.category_id === category) &&
      (verification === "all" ||
        (verification === "verified"
          ? entry.verified
          : entry.verification_required && !entry.verified)),
  );
  const categoryById = new Map(data.categories.map((item) => [item.id, item]));
  const reports = [
    "Semester Summary",
    "Weekly Timesheet",
    "Monthly Summary",
    "Professional Development",
    "Clinical Days",
    "Absences",
    "School Closures",
    "Verification Status",
    "Category Breakdown",
    "Detailed Time Log",
  ];
  const download = async (formatType: "csv" | "json" | "pdf") => {
    setExporting(true);
    try {
      if (formatType === "pdf") {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text(`Teaching Time Tracker — ${report}`, 18, 20);
        doc.setFontSize(10);
        doc.text(
          `${semester.name} · Generated ${format(new Date(), "MMMM d, yyyy")}`,
          18,
          28,
        );
        let y = 40;
        filtered.forEach((entry, index) => {
          if (y > 275) {
            doc.addPage();
            y = 20;
          }
          const cat = categoryById.get(entry.category_id);
          doc.text(
            `${entry.entry_date}  ${cat?.name ?? "Category"}  ${(entry.duration_minutes / 60).toFixed(1)} hr  ${entry.description}`,
            18,
            y,
          );
          y += 7;
          if (index === filtered.length - 1) {
            y += 4;
            doc.text(
              `Total: ${(filtered.reduce((sum, e) => sum + e.duration_minutes, 0) / 60).toFixed(1)} hours`,
              18,
              y,
            );
          }
        });
        const path = isTauri()
          ? await save({
              defaultPath: `${semester.name}-${report}.pdf`,
              filters: [{ name: "PDF report", extensions: ["pdf"] }],
            })
          : null;
        if (path)
          await writeFile(path, new Uint8Array(doc.output("arraybuffer")));
        else if (!isTauri()) doc.save(`${semester.name}-${report}.pdf`);
      } else {
        const content = await exportData(formatType, semester.id);
        const path = isTauri()
          ? await save({
              defaultPath: `${semester.name}-${report}.${formatType}`,
              filters: [
                { name: formatType.toUpperCase(), extensions: [formatType] },
              ],
            })
          : null;
        if (path) await writeTextFile(path, content);
        else if (!isTauri()) {
          const blob = new Blob([content]);
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${semester.name}-${report}.${formatType}`;
          link.click();
        }
      }
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="standard-page">
      <PageHeading
        eyebrow="Documents & exports"
        title="Reports"
        description="Create polished records for your program, supervisor, or archive."
      />
      <div className="report-layout">
        <aside className="report-picker">
          {reports.map((item) => (
            <button
              key={item}
              className={report === item ? "active" : ""}
              onClick={() => setReport(item)}
            >
              <FileText />
              {item}
              <ChevronRight />
            </button>
          ))}
        </aside>
        <section className="report-workspace">
          <header>
            <div>
              <Pill tone="blue">{report}</Pill>
              <h2>{semester.name}</h2>
              <p>
                {format(parseISO(semester.start_date), "MMM d, yyyy")} –{" "}
                {format(parseISO(semester.end_date), "MMM d, yyyy")}
              </p>
            </div>
            <div className="report-actions">
              <Button
                variant="secondary"
                disabled={exporting}
                onClick={() => download("csv")}
              >
                <FileSpreadsheet size={16} /> CSV
              </Button>
              <Button
                variant="secondary"
                disabled={exporting}
                onClick={() => download("json")}
              >
                <FileJson size={16} /> JSON
              </Button>
              <Button disabled={exporting} onClick={() => download("pdf")}>
                <Download size={16} /> PDF
              </Button>
            </div>
          </header>
          <div className="report-filters">
            <Field label="Category">
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All categories</option>
                {data.categories.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Verification">
              <select
                className="input"
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
              >
                <option value="all">All entries</option>
                <option value="verified">Verified</option>
                <option value="needed">Needs verification</option>
              </select>
            </Field>
            <div className="report-total">
              <small>Filtered total</small>
              <strong>
                {(
                  filtered.reduce(
                    (sum, item) => sum + item.duration_minutes,
                    0,
                  ) / 60
                ).toFixed(1)}{" "}
                hours
              </strong>
            </div>
          </div>
          <div className="report-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const cat = categoryById.get(entry.category_id);
                  return (
                    <tr key={entry.id}>
                      <td>
                        {format(parseISO(entry.entry_date), "MMM d, yyyy")}
                      </td>
                      <td>
                        <span className="table-category">
                          <i style={{ background: cat?.color }} />
                          <CategoryIcon name={cat?.icon ?? ""} />
                          {cat?.name}
                        </span>
                      </td>
                      <td>{entry.description || "—"}</td>
                      <td>{entry.location || "—"}</td>
                      <td>{(entry.duration_minutes / 60).toFixed(1)}</td>
                      <td>
                        {entry.verification_required ? (
                          <Pill tone={entry.verified ? "green" : "amber"}>
                            {entry.verified ? "Verified" : "Needed"}
                          </Pill>
                        ) : (
                          <Pill>Not required</Pill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="table-empty">No entries match these filters.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const { data } = useActiveData();
  const saveCategory = useAppStore((state) => state.saveCategory);
  const [draft, setDraft] = useState<CategoryInput | null>(null);
  return (
    <div className="standard-page">
      <PageHeading
        eyebrow="Organization"
        title="Categories"
        description="Use colors, names, and icons to make every type of work recognizable."
        action={
          <Button
            onClick={() =>
              setDraft({
                name: "",
                abbreviation: "",
                color: "#6f8edb",
                icon: "MoreHorizontal",
                counts_clinical: false,
                counts_pd: false,
                is_absence: false,
                is_closure: false,
                active: true,
                sort_order: data.categories.length,
              })
            }
          >
            <Plus /> New category
          </Button>
        }
      />
      <div className="category-management-grid">
        {data.categories.map((category) => (
          <button
            className={`category-management-card ${!category.active ? "archived" : ""}`}
            key={category.id}
            onClick={() => setDraft({ ...category })}
          >
            <span
              className="category-big-icon"
              style={{
                background: `${category.color}22`,
                color: category.color,
              }}
            >
              <CategoryIcon name={category.icon} />
            </span>
            <div>
              <h3>{category.name}</h3>
              <p>
                {category.abbreviation} ·{" "}
                {category.active ? "Active" : "Archived"}
              </p>
              <div className="category-flags">
                {category.counts_clinical && <Pill tone="blue">Clinical</Pill>}
                {category.counts_pd && <Pill tone="green">PD</Pill>}
                {category.is_absence && <Pill tone="red">Absence</Pill>}
                {category.is_closure && <Pill>Closure</Pill>}
              </div>
            </div>
            <i style={{ background: category.color }} />
          </button>
        ))}
      </div>
      <CategoryModal
        draft={draft}
        close={() => setDraft(null)}
        save={async (input) => {
          await saveCategory(input);
          setDraft(null);
        }}
      />
    </div>
  );
}

function CategoryModal({
  draft,
  close,
  save,
}: {
  draft: CategoryInput | null;
  close: () => void;
  save: (input: CategoryInput) => Promise<void>;
}) {
  const [local, setLocal] = useState<CategoryInput | null>(null);
  const value = local?.id === draft?.id ? local : draft;
  if (!value) return null;
  const update = (patch: Partial<CategoryInput>) =>
    setLocal({ ...value, ...patch });
  return (
    <Modal
      open
      title={value.id ? "Edit category" : "New category"}
      onClose={close}
      className="category-modal"
    >
      <div className="category-preview">
        <span style={{ background: `${value.color}22`, color: value.color }}>
          <CategoryIcon name={value.icon} />
        </span>
        <strong>{value.name || "New category"}</strong>
        <small>{value.abbreviation || "ABBR"}</small>
      </div>
      <div className="form-grid modal-form">
        <Field label="Name">
          <Input
            value={value.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </Field>
        <Field label="Abbreviation">
          <Input
            maxLength={5}
            value={value.abbreviation}
            onChange={(e) =>
              update({ abbreviation: e.target.value.toUpperCase() })
            }
          />
        </Field>
        <Field label="Color">
          <Input
            type="color"
            value={value.color}
            onChange={(e) => update({ color: e.target.value })}
          />
        </Field>
        <Field label="Icon">
          <select
            className="input"
            value={value.icon}
            onChange={(e) => update({ icon: e.target.value })}
          >
            {[
              "BookOpen",
              "GraduationCap",
              "Users",
              "Coffee",
              "MessagesSquare",
              "ClipboardList",
              "CheckSquare",
              "Eye",
              "CircleAlert",
              "School",
              "MoreHorizontal",
            ].map((icon) => (
              <option key={icon}>{icon}</option>
            ))}
          </select>
        </Field>
        <div className="field-wide settings-toggles">
          <Toggle
            checked={value.counts_clinical}
            onChange={(counts_clinical) => update({ counts_clinical })}
            label="Counts toward clinical days"
          />
          <Toggle
            checked={value.counts_pd}
            onChange={(counts_pd) => update({ counts_pd })}
            label="Counts toward professional development"
          />
          <Toggle
            checked={value.is_absence}
            onChange={(is_absence) => update({ is_absence })}
            label="Represents an absence"
          />
          <Toggle
            checked={value.is_closure}
            onChange={(is_closure) => update({ is_closure })}
            label="Represents a school closure"
          />
          <Toggle
            checked={value.active}
            onChange={(active) => update({ active })}
            label="Active category"
          />
        </div>
      </div>
      <footer className="modal-actions">
        <span />
        <div>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!value.name || !value.abbreviation}
            onClick={() => save(value)}
          >
            <Save /> Save category
          </Button>
        </div>
      </footer>
    </Modal>
  );
}

export function RemindersPage() {
  const { data, semester } = useActiveData();
  const { saveReminder, deleteReminder } = useAppStore();
  const [draft, setDraft] = useState<ReminderInput | null>(null);
  const notify = async () => {
    if (!isTauri()) {
      alert("Native notifications are available in the desktop app.");
      return;
    }
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted)
      sendNotification({
        title: "Teaching Time Tracker",
        body: "Remember to add today's teaching time.",
      });
  };
  return (
    <div className="standard-page">
      <PageHeading
        eyebrow="Stay on track"
        title="Reminders"
        description="Gentle, local desktop prompts that keep your records complete."
        action={
          <Button
            onClick={() =>
              setDraft({
                reminder_type: "daily_time",
                title: "Add today’s teaching time",
                enabled: true,
                days: "Mon,Tue,Wed,Thu,Fri",
                time_of_day: "17:00",
                semester_id: semester.id,
              })
            }
          >
            <Plus /> Add reminder
          </Button>
        }
      />
      <div className="reminder-banner">
        <Bell />
        <div>
          <strong>Desktop notifications stay on this device</strong>
          <p>
            No account, email, or server is involved. The operating system
            handles permission.
          </p>
        </div>
        <Button variant="secondary" onClick={notify}>
          Send test
        </Button>
      </div>
      <div className="reminder-list">
        {data.reminders.map((reminder) => (
          <div
            className={`reminder-card ${!reminder.enabled ? "disabled" : ""}`}
            key={reminder.id}
          >
            <span>
              <Bell />
            </span>
            <div>
              <h3>{reminder.title}</h3>
              <p>
                {reminder.days} · {reminder.time_of_day}
              </p>
              <Pill tone={reminder.enabled ? "green" : "neutral"}>
                {reminder.enabled ? "Enabled" : "Paused"}
              </Pill>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDraft({ ...reminder })}
            >
              <Edit3 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm("Delete this reminder?"))
                  void deleteReminder(reminder.id);
              }}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {!data.reminders.length && (
          <EmptyState
            icon={<Bell />}
            title="No reminders yet"
            body="Create a prompt for daily time, incomplete weeks, verification, or goals."
          />
        )}
      </div>
      <ReminderModal
        draft={draft}
        close={() => setDraft(null)}
        save={async (value) => {
          await saveReminder(value);
          setDraft(null);
        }}
      />
    </div>
  );
}

function ReminderModal({
  draft,
  close,
  save,
}: {
  draft: ReminderInput | null;
  close: () => void;
  save: (value: ReminderInput) => Promise<void>;
}) {
  const [local, setLocal] = useState<ReminderInput | null>(null);
  const value = local?.id === draft?.id ? local : draft;
  if (!value) return null;
  const update = (patch: Partial<ReminderInput>) =>
    setLocal({ ...value, ...patch });
  return (
    <Modal
      open
      title={value.id ? "Edit reminder" : "New reminder"}
      onClose={close}
    >
      <div className="form-grid modal-form">
        <Field label="Reminder type">
          <select
            className="input"
            value={value.reminder_type}
            onChange={(e) => update({ reminder_type: e.target.value })}
          >
            <option value="daily_time">Add today’s time</option>
            <option value="unverified">Unverified hours</option>
            <option value="weekly_incomplete">
              Weekly timecard incomplete
            </option>
            <option value="goal">Goal milestone</option>
          </select>
        </Field>
        <Field label="Time">
          <Input
            type="time"
            value={value.time_of_day}
            onChange={(e) => update({ time_of_day: e.target.value })}
          />
        </Field>
        <Field label="Title" wide>
          <Input
            value={value.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </Field>
        <Field label="Days" wide hint="Comma-separated day abbreviations">
          <Input
            value={value.days}
            onChange={(e) => update({ days: e.target.value })}
          />
        </Field>
        <div className="field-wide">
          <Toggle
            checked={value.enabled}
            onChange={(enabled) => update({ enabled })}
            label="Reminder enabled"
          />
        </div>
      </div>
      <footer className="modal-actions">
        <span />
        <div>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => save(value)}>
            <Save /> Save reminder
          </Button>
        </div>
      </footer>
    </Modal>
  );
}

export function BackupPage() {
  const { data } = useActiveData();
  const setData = useAppStore((state) => state.setData);
  const initialize = useAppStore((state) => state.initialize);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const [directory, setDirectory] = useState(
    data.settings.backup_directory ?? "",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const updatePolicy = (patch: Partial<AppSettings>) =>
    saveSettings({
      ...data.settings,
      ...patch,
      backup_directory: directory || data.settings.backup_directory,
    });
  const chooseFolder = async () => {
    if (!isTauri()) return;
    const result = await open({
      directory: true,
      multiple: false,
      title: "Choose backup folder",
    });
    if (typeof result === "string") {
      setDirectory(result);
      await updatePolicy({ backup_directory: result });
    }
  };
  const backup = async () => {
    setBusy(true);
    try {
      await createBackup(directory || undefined, password || undefined);
      await initialize();
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    if (!isTauri()) {
      alert("Restore is available in the desktop application.");
      return;
    }
    const result = await open({
      multiple: false,
      filters: [
        {
          name: "Teaching Time Tracker backup",
          extensions: ["teachingtracker"],
        },
      ],
    });
    if (
      typeof result === "string" &&
      confirm(
        "Restore this backup? A safety backup of your current data will be created first.",
      )
    ) {
      setBusy(true);
      try {
        setData(await restoreBackup(result, password || undefined));
      } finally {
        setBusy(false);
      }
    }
  };
  return (
    <div className="standard-page">
      <PageHeading
        eyebrow="Data protection"
        title="Backup & Sync"
        description="Safe, versioned snapshots—never a live cloud-synced SQLite database."
        action={
          <Button onClick={backup} disabled={busy}>
            <UploadCloud /> {busy ? "Working…" : "Backup now"}
          </Button>
        }
      />
      <div className="backup-hero">
        <div className="backup-shield">
          <PackageCheck />
        </div>
        <div>
          <Pill tone={data.settings.last_backup_at ? "green" : "amber"}>
            {data.settings.last_backup_at ? "Protected" : "Backup recommended"}
          </Pill>
          <h2>
            {data.settings.last_backup_at
              ? `Last backup ${formatDistanceToNow(parseISO(data.settings.last_backup_at), { addSuffix: true })}`
              : "Create your first backup"}
          </h2>
          <p>
            Each snapshot contains a consistent SQLite copy and version metadata
            with a SHA-256 checksum.
          </p>
        </div>
        <div className="backup-hero-actions">
          <Button variant="secondary" onClick={restore}>
            <Archive /> Restore
          </Button>
          <Button onClick={backup} disabled={busy}>
            <HardDrive /> Backup now
          </Button>
        </div>
      </div>
      <div className="backup-grid">
        <section className="settings-card">
          <header>
            <span>
              <Folder />
            </span>
            <div>
              <h3>Local backup destination</h3>
              <p>
                External drives, network folders, and cloud-mounted folders work
                here.
              </p>
            </div>
          </header>
          <div className="folder-picker">
            <Input
              value={directory}
              readOnly
              placeholder="Default app backup folder"
            />
            <Button variant="secondary" onClick={chooseFolder}>
              Choose folder
            </Button>
          </div>
          <div className="backup-policy">
            <Toggle
              checked={data.settings.automatic_backup ?? false}
              onChange={(automatic_backup) =>
                void updatePolicy({ automatic_backup })
              }
              label="Automatic backups"
              description="Create a snapshot when the interval has elapsed"
            />
            <select
              className="input"
              aria-label="Automatic backup frequency"
              value={data.settings.backup_frequency ?? "weekly"}
              onChange={(event) =>
                void updatePolicy({
                  backup_frequency: event.target.value as "daily" | "weekly",
                })
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <Toggle
              checked={data.settings.backup_on_close ?? false}
              onChange={(backup_on_close) =>
                void updatePolicy({ backup_on_close })
              }
              label="Backup on app close"
            />
            <Field label="Keep latest">
              <select
                className="input"
                value={data.settings.backup_retention_count ?? 10}
                onChange={(event) =>
                  void updatePolicy({
                    backup_retention_count: Number(event.target.value),
                  })
                }
              >
                {[5, 10, 20, 50].map((count) => (
                  <option key={count} value={count}>
                    {count} backups
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="encryption-box">
            <LockKeyhole />
            <div>
              <strong>Optional encrypted backups</strong>
              <p>
                AES-256-GCM with an Argon2id-derived key. Your password is never
                stored.
              </p>
            </div>
          </div>
          <Field
            label="Backup password"
            hint="If you lose this password, encrypted backups cannot be recovered."
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for standard backup"
            />
          </Field>
        </section>
        <section className="settings-card provider-card">
          <header>
            <span>
              <Cloud />
            </span>
            <div>
              <h3>Backup destinations</h3>
              <p>Providers share the same safe snapshot workflow.</p>
            </div>
          </header>
          <Provider
            name="iCloud Drive"
            detail="Select an iCloud Drive folder above"
            status={
              navigator.platform.includes("Mac") ? "Available" : "macOS only"
            }
          />
          <Provider
            name="Custom folder"
            detail="Local, network, external, or cloud-mounted"
            status="Available"
          />
          <Provider
            name="Google Drive"
            detail="OAuth application credentials required"
            status="Not configured"
          />
          <Provider
            name="Microsoft OneDrive"
            detail="OAuth application credentials required"
            status="Not configured"
          />
          <Provider
            name="Dropbox"
            detail="OAuth application credentials required"
            status="Not configured"
          />
        </section>
      </div>
      <section className="backup-history">
        <header>
          <div>
            <h2>Backup history</h2>
            <p>
              Newest snapshots appear first. Checksums help confirm file
              integrity.
            </p>
          </div>
        </header>
        {data.backups.length ? (
          <div className="backup-table">
            {data.backups.map((record) => (
              <div key={record.id}>
                <span className="backup-file-icon">
                  <FileText />
                </span>
                <div>
                  <strong>{record.file_path.split(/[\\/]/).at(-1)}</strong>
                  <small>
                    {format(
                      parseISO(record.created_at),
                      "MMM d, yyyy · h:mm a",
                    )}{" "}
                    · {(record.size_bytes / 1024).toFixed(1)} KB
                  </small>
                </div>
                {record.encrypted && (
                  <Pill tone="blue">
                    <KeyRound /> Encrypted
                  </Pill>
                )}
                <span className="checksum">
                  {record.checksum.slice(0, 12)}…
                </span>
                <Pill tone={record.status === "success" ? "green" : "red"}>
                  {record.status}
                </Pill>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<HardDrive />}
            title="No backups yet"
            body="Choose a destination and create your first safe snapshot."
          />
        )}
      </section>
    </div>
  );
}

function Provider({
  name,
  detail,
  status,
}: {
  name: string;
  detail: string;
  status: string;
}) {
  return (
    <div className="provider-row">
      <span className="provider-logo">
        {name === "Custom folder" ? <Folder /> : <Cloud />}
      </span>
      <div>
        <strong>{name}</strong>
        <small>{detail}</small>
      </div>
      <Pill tone={status === "Available" ? "green" : "neutral"}>{status}</Pill>
    </div>
  );
}

export function SettingsPage() {
  const { data, semester } = useActiveData();
  const saveSettings = useAppStore((state) => state.saveSettings);
  const [settings, setSettings] = useState<AppSettings>(data.settings);
  const [editingSemester, setEditingSemester] = useState(false);
  const savePrefs = () => saveSettings(settings);
  return (
    <div className="standard-page settings-page">
      <PageHeading
        eyebrow="Preferences"
        title="Settings"
        description="Make Teaching Time Tracker fit the way you work."
        action={
          <Button onClick={savePrefs}>
            <Save /> Save settings
          </Button>
        }
      />
      <div className="settings-layout">
        <aside>
          <a href="#general">General</a>
          <a href="#appearance">Appearance</a>
          <a href="#semester">Semester</a>
          <a href="#time-rules">Time rules</a>
          <a href="#privacy">Privacy</a>
          <a href="#about">About</a>
        </aside>
        <div className="settings-stack">
          <section className="settings-card" id="general">
            <header>
              <span>
                <SettingsGlyph />
              </span>
              <div>
                <h3>General</h3>
                <p>Date, time, and entry defaults.</p>
              </div>
            </header>
            <div className="settings-form-grid">
              <Field label="Week starts">
                <select
                  className="input"
                  value={settings.week_starts_on ?? "sunday"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      week_starts_on: e.target.value as "sunday" | "monday",
                    })
                  }
                >
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                </select>
              </Field>
              <Field label="Clock">
                <select
                  className="input"
                  value={settings.clock_format ?? "12"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      clock_format: e.target.value as "12" | "24",
                    })
                  }
                >
                  <option value="12">12-hour</option>
                  <option value="24">24-hour</option>
                </select>
              </Field>
              <Field label="Default duration">
                <select
                  className="input"
                  value={settings.default_duration ?? 360}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_duration: Number(e.target.value),
                    })
                  }
                >
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="300">5 hours</option>
                  <option value="360">6 hours</option>
                </select>
              </Field>
              <Field label="Default category">
                <select
                  className="input"
                  value={settings.default_category_id ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_category_id: e.target.value,
                    })
                  }
                >
                  <option value="">First active category</option>
                  {data.categories
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          </section>
          <section className="settings-card" id="appearance">
            <header>
              <span>
                <Palette />
              </span>
              <div>
                <h3>Appearance</h3>
                <p>A calm theme for every environment.</p>
              </div>
            </header>
            <div className="theme-options">
              {(["light", "dark", "system"] as const).map((theme) => (
                <button
                  className={
                    (settings.theme ?? "system") === theme ? "active" : ""
                  }
                  key={theme}
                  onClick={() => setSettings({ ...settings, theme })}
                >
                  <span className={`theme-preview ${theme}`}>
                    <i />
                    <i />
                    <i />
                  </span>
                  <strong>{theme[0].toUpperCase() + theme.slice(1)}</strong>
                  {(settings.theme ?? "system") === theme && <Check />}
                </button>
              ))}
            </div>
          </section>
          <section className="settings-card" id="semester">
            <header>
              <span>
                <CalendarCheck />
              </span>
              <div>
                <h3>Current semester</h3>
                <p>
                  {semester.name} · {semester.school || "No school set"}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setEditingSemester(true)}
              >
                Edit semester
              </Button>
            </header>
            <dl className="semester-details">
              <div>
                <dt>Dates</dt>
                <dd>
                  {format(parseISO(semester.start_date), "MMM d")} –{" "}
                  {format(parseISO(semester.end_date), "MMM d, yyyy")}
                </dd>
              </div>
              <div>
                <dt>Cooperating teacher</dt>
                <dd>{semester.cooperating_teacher || "Not set"}</dd>
              </div>
              <div>
                <dt>University supervisor</dt>
                <dd>{semester.university_supervisor || "Not set"}</dd>
              </div>
            </dl>
          </section>
          <section className="settings-card" id="time-rules">
            <header>
              <span>
                <Clock3 />
              </span>
              <div>
                <h3>Time rules</h3>
                <p>Thresholds are configured per semester.</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setEditingSemester(true)}
              >
                Edit rules
              </Button>
            </header>
            <div className="rule-pills">
              <Pill tone="blue">½ day at {semester.half_day_threshold} hr</Pill>
              <Pill tone="green">
                Full day at {semester.full_day_threshold} hr
              </Pill>
              <Pill>
                {semester.partial_hours_accumulate
                  ? "Partial hours accumulate"
                  : "Threshold credit only"}
              </Pill>
            </div>
          </section>
          <section className="settings-card" id="privacy">
            <header>
              <span>
                <LockKeyhole />
              </span>
              <div>
                <h3>Privacy & data</h3>
                <p>Your records are held in local SQLite storage.</p>
              </div>
            </header>
            <div className="privacy-callout">
              <WifiOff />
              <div>
                <strong>No account. No analytics. No server.</strong>
                <p>
                  The app works fully offline. Data leaves your device only when
                  you intentionally export or back it up.
                </p>
              </div>
            </div>
          </section>
          <section className="settings-card about-card" id="about">
            <header>
              <span>
                <Sparkles />
              </span>
              <div>
                <h3>Teaching Time Tracker</h3>
                <p>Version 1.0.3 · Tauri 2 desktop application</p>
              </div>
            </header>
            <p>
              Designed for student teachers who deserve calm, dependable tools
              for important work.
            </p>
            <button
              onClick={() => useAppStore.getState().setShortcutsOpen(true)}
            >
              View keyboard shortcuts
            </button>
          </section>
        </div>
      </div>
      <SemesterModal
        semester={editingSemester ? semester : null}
        close={() => setEditingSemester(false)}
      />
    </div>
  );
}

function SemesterModal({
  semester,
  close,
}: {
  semester: import("@/types").Semester | null;
  close: () => void;
}) {
  const saveSemester = useAppStore((state) => state.saveSemester);
  const [local, setLocal] = useState<SemesterInput | null>(null);
  const value =
    local?.id === semester?.id ? local : semester ? { ...semester } : null;
  if (!value) return null;
  const update = (patch: Partial<SemesterInput>) =>
    setLocal({ ...value, ...patch });
  return (
    <Modal
      open
      title="Semester & requirement rules"
      onClose={close}
      className="semester-modal"
    >
      <div className="form-grid modal-form">
        <Field label="Semester name" wide>
          <Input
            value={value.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </Field>
        <Field label="Start date">
          <Input
            type="date"
            value={value.start_date}
            onChange={(e) => update({ start_date: e.target.value })}
          />
        </Field>
        <Field label="End date">
          <Input
            type="date"
            value={value.end_date}
            onChange={(e) => update({ end_date: e.target.value })}
          />
        </Field>
        <Field label="Required clinical days">
          <Input
            type="number"
            step="0.5"
            value={value.required_clinical_days}
            onChange={(e) =>
              update({ required_clinical_days: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Required PD hours">
          <Input
            type="number"
            step="0.5"
            value={value.required_pd_hours}
            onChange={(e) =>
              update({ required_pd_hours: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Half-day threshold">
          <Input
            type="number"
            step="0.25"
            value={value.half_day_threshold}
            onChange={(e) =>
              update({ half_day_threshold: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Full-day threshold">
          <Input
            type="number"
            step="0.25"
            value={value.full_day_threshold}
            onChange={(e) =>
              update({ full_day_threshold: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="School" wide>
          <Input
            value={value.school}
            onChange={(e) => update({ school: e.target.value })}
          />
        </Field>
        <Field label="Cooperating teacher">
          <Input
            value={value.cooperating_teacher}
            onChange={(e) => update({ cooperating_teacher: e.target.value })}
          />
        </Field>
        <Field label="University supervisor">
          <Input
            value={value.university_supervisor}
            onChange={(e) => update({ university_supervisor: e.target.value })}
          />
        </Field>
        <div className="field-wide settings-toggles">
          <Toggle
            checked={value.partial_hours_accumulate}
            onChange={(partial_hours_accumulate) =>
              update({ partial_hours_accumulate })
            }
            label="Accumulate partial clinical hours"
          />
          <Toggle
            checked={value.pd_counts_clinical}
            onChange={(pd_counts_clinical) => update({ pd_counts_clinical })}
            label="PD counts toward clinical days"
          />
          <Toggle
            checked={value.subbing_counts}
            onChange={(subbing_counts) => update({ subbing_counts })}
            label="Subbing counts toward clinical days"
          />
          <Toggle
            checked={value.archived}
            onChange={(archived) => update({ archived })}
            label="Archive semester"
          />
        </div>
      </div>
      <footer className="modal-actions">
        <span />
        <div>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await saveSemester(value);
              close();
            }}
          >
            <Save /> Save semester
          </Button>
        </div>
      </footer>
    </Modal>
  );
}

function SummaryMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function MetricCard({
  label,
  value,
  suffix,
  icon,
  tone,
}: {
  label: string;
  value: string;
  suffix: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="metric-card">
      <span className={`metric-icon ${tone}`}>{icon}</span>
      <small>{label}</small>
      <h3>
        {value} <em>{suffix}</em>
      </h3>
    </div>
  );
}
function SettingsGlyph() {
  return <MoreHorizontal />;
}
