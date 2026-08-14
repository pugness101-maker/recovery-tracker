import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, CheckCircle2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import "./styles.css";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MODULES = ["Sleep", "Study", "Workout", "Taper", "Family", "Money", "Faith"];
const CATEGORIES = ["Custom", "Sleep", "Study", "Workout", "Taper", "Family", "Money", "Faith"];
const STATUSES = ["No data", "Completed", "Partial", "Inconsistent", "Missed", "Skipped"];
const RANGES = ["7 days", "Month", "Custom range"];
const STATUS_CLASS = {
  "No data": "status-gray",
  Completed: "status-green",
  Partial: "status-yellow",
  Inconsistent: "status-orange",
  Missed: "status-red",
  Skipped: "status-gray"
};

const todayISO = () => toISO(new Date());
const defaultSettings = {
  name: "Daily System",
  wakeTime: "07:30",
  bedtime: "23:00",
  modules: { Sleep: true, Study: true, Workout: true, Taper: true, Family: false, Money: false, Faith: false }
};
const defaultWorkout = { days: ["Tuesday", "Thursday"], time: "18:30", duration: "70 min", type: "Wrestling", location: "" };
const defaultTaper = { startDate: todayISO(), endDate: addDaysISO(todayISO(), 28), targetAmount: "6", unit: "g", duration: "00:20", breakHours: "4" };
const defaultLog = {
  status: "No data",
  notes: "",
  manualTasks: "",
  taskStatuses: {},
  metricOverrides: {},
  usage: { amount: "", unit: "g", startTime: "", endTime: "", sessions: "", craving: "3", trigger: "Bored", notes: "" }
};
const blankTask = {
  taskName: "",
  startTime: "09:00",
  duration: "30 min",
  category: "Custom",
  repeatDays: ["Monday"],
  scheduleType: "Weekly repeat",
  date: todayISO(),
  metric: "None",
  impactType: "Add",
  metricValue: "",
  notes: ""
};

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [tab, setTab] = useState(() => read("sb-tab", "setup"));
  const [settings, setSettings] = useState(() => read("sb-settings", defaultSettings));
  const [workout, setWorkout] = useState(() => read("sb-workout", defaultWorkout));
  const [taper, setTaper] = useState(() => read("sb-taper", defaultTaper));
  const [tasks, setTasks] = useState(() => read("sb-tasks", []));
  const [newTask, setNewTask] = useState(blankTask);
  const [logs, setLogs] = useState(() => read("sb-logs", {}));
  const [selectedDate, setSelectedDate] = useState(null);
  const [range, setRange] = useState(() => read("sb-range", "7 days"));
  const [month, setMonth] = useState(() => read("sb-month", todayISO().slice(0, 7)));
  const [customRange, setCustomRange] = useState(() => read("sb-custom-range", { start: todayISO(), end: addDaysISO(todayISO(), 6) }));
  const [viewMode, setViewMode] = useState(() => read("sb-view-mode", "System View"));
  const [showMetrics, setShowMetrics] = useState(() => read("sb-show-metrics", false));
  const [categoryFilter, setCategoryFilter] = useState(() => read("sb-category-filter", "All"));
  const [saved, setSaved] = useState(() => read("sb-saved", []));

  useEffect(() => localStorage.setItem("sb-tab", JSON.stringify(tab)), [tab]);
  useEffect(() => localStorage.setItem("sb-settings", JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem("sb-workout", JSON.stringify(workout)), [workout]);
  useEffect(() => localStorage.setItem("sb-taper", JSON.stringify(taper)), [taper]);
  useEffect(() => localStorage.setItem("sb-tasks", JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem("sb-logs", JSON.stringify(logs)), [logs]);
  useEffect(() => localStorage.setItem("sb-range", JSON.stringify(range)), [range]);
  useEffect(() => localStorage.setItem("sb-month", JSON.stringify(month)), [month]);
  useEffect(() => localStorage.setItem("sb-custom-range", JSON.stringify(customRange)), [customRange]);
  useEffect(() => localStorage.setItem("sb-view-mode", JSON.stringify(viewMode)), [viewMode]);
  useEffect(() => localStorage.setItem("sb-show-metrics", JSON.stringify(showMetrics)), [showMetrics]);
  useEffect(() => localStorage.setItem("sb-category-filter", JSON.stringify(categoryFilter)), [categoryFilter]);
  useEffect(() => localStorage.setItem("sb-saved", JSON.stringify(saved)), [saved]);

  const dates = useMemo(() => buildDates(resolveRange(range, month, customRange)), [range, month, customRange]);
  const selectedLog = selectedDate ? { ...defaultLog, ...(logs[selectedDate] || {}) } : null;
  const selectedTasks = selectedDate ? tasksForDate(tasks, selectedDate) : [];
  const taperProgress = useMemo(() => buildTaperProgress(dates, logs, taper), [dates, logs, taper]);
  const summaries = useMemo(() => weekSummaries(dates, tasks, logs), [dates, tasks, logs]);

  function updateLog(date, key, value) {
    setLogs((current) => ({ ...current, [date]: { ...defaultLog, ...(current[date] || {}), [key]: value } }));
  }
  function updateUsage(date, key, value) {
    setLogs((current) => {
      const day = { ...defaultLog, ...(current[date] || {}) };
      return { ...current, [date]: { ...day, usage: { ...defaultLog.usage, ...(day.usage || {}), [key]: value } } };
    });
  }
  function updateTaskStatus(date, id, value) {
    setLogs((current) => {
      const day = { ...defaultLog, ...(current[date] || {}) };
      return { ...current, [date]: { ...day, taskStatuses: { ...day.taskStatuses, [id]: value } } };
    });
  }
  function updateMetricOverride(date, id, value) {
    setLogs((current) => {
      const day = { ...defaultLog, ...(current[date] || {}) };
      return { ...current, [date]: { ...day, metricOverrides: { ...day.metricOverrides, [id]: value } } };
    });
  }
  function generateSystem() {
    const generated = [];
    const add = (task) => generated.push({ id: crypto.randomUUID(), scheduleType: "Weekly repeat", repeatDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], date: todayISO(), notes: "", metric: "None", impactType: "Add", metricValue: "", ...task });
    if (settings.modules.Sleep) {
      add({ taskName: "Wake + water", startTime: settings.wakeTime, duration: "10 min", category: "Sleep", metric: "Sleep hours", impactType: "Mark complete" });
      add({ taskName: "Night routine", startTime: shiftTime(settings.bedtime, -45), duration: "45 min", category: "Sleep", metric: "Sleep hours", impactType: "Mark complete" });
    }
    if (settings.modules.Study) add({ taskName: "Focused study block", startTime: "10:00", duration: "90 min", category: "Study", metric: "Study hours", impactType: "Add", metricValue: "1.5" });
    if (settings.modules.Workout) add({ taskName: workout.type, startTime: workout.time, duration: workout.duration, category: "Workout", repeatDays: workout.days, metric: "Workout minutes", impactType: "Add", metricValue: String(durationToMinutes(workout.duration)), location: workout.location });
    if (settings.modules.Taper) add({ taskName: "Taper check-in", startTime: "19:00", duration: "10 min", category: "Taper", metric: "Taper progress", impactType: "Mark complete" });
    if (settings.modules.Faith) add({ taskName: "Prayer or journal", startTime: shiftTime(settings.wakeTime, 20), duration: "15 min", category: "Faith", metric: "Prayer/journal completed", impactType: "Mark complete" });
    setTasks(generated);
    setTab("plan");
  }
  function addTask(event) {
    event.preventDefault();
    if (!newTask.taskName.trim()) return;
    setTasks((current) => [...current, { ...newTask, id: crypto.randomUUID(), taskName: newTask.taskName.trim() }]);
    setNewTask(blankTask);
    setTab("plan");
  }
  function saveSystem() {
    const item = { id: crypto.randomUUID(), name: settings.name || "Untitled System", settings, workout, taper, tasks };
    setSaved((current) => [item, ...current]);
    setTab("saved");
  }
  function loadSystem(item) {
    setSettings(item.settings || defaultSettings);
    setWorkout(item.workout || defaultWorkout);
    setTaper(item.taper || defaultTaper);
    setTasks(item.tasks || []);
    setTab("plan");
  }

  return (
    <main className="app-shell">
      <section className="intro">
        <div><p className="eyebrow">One simple system</p><h1>Systems Builder</h1></div>
        <div className="focus-pill"><CheckCircle2 size={16} />{tasks.length} blocks</div>
      </section>
      <nav className="tab-bar">
        {["setup", "plan", "add", "saved"].map((name) => {
          const Icon = name === "setup" ? Sparkles : name === "plan" ? CalendarDays : name === "add" ? Plus : Save;
          return <button key={name} className={tab === name ? "tab-button is-active" : "tab-button"} onClick={() => setTab(name)}><Icon size={17} /><span>{cap(name)}</span></button>;
        })}
      </nav>

      {tab === "setup" && <Setup settings={settings} setSettings={setSettings} workout={workout} setWorkout={setWorkout} taper={taper} setTaper={setTaper} generateSystem={generateSystem} saveSystem={saveSystem} />}
      {tab === "plan" && <Plan tasks={tasks} logs={logs} settings={settings} taper={taper} dates={dates} summaries={summaries} taperProgress={taperProgress} range={range} setRange={setRange} month={month} setMonth={setMonth} customRange={customRange} setCustomRange={setCustomRange} viewMode={viewMode} setViewMode={setViewMode} showMetrics={showMetrics} setShowMetrics={setShowMetrics} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} setSelectedDate={setSelectedDate} />}
      {tab === "add" && <AddTask newTask={newTask} setNewTask={setNewTask} addTask={addTask} />}
      {tab === "saved" && <Saved saved={saved} setSaved={setSaved} loadSystem={loadSystem} />}
      {selectedDate && <DayModal date={selectedDate} log={selectedLog} tasks={selectedTasks} taper={taper} logs={logs} close={() => setSelectedDate(null)} updateLog={updateLog} updateUsage={updateUsage} updateTaskStatus={updateTaskStatus} updateMetricOverride={updateMetricOverride} />}
    </main>
  );
}

function Setup({ settings, setSettings, workout, setWorkout, taper, setTaper, generateSystem, saveSystem }) {
  const updateSettings = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const toggleModule = (module) => setSettings((current) => ({ ...current, modules: { ...current.modules, [module]: !current.modules[module] } }));
  const updateWorkout = (key, value) => setWorkout((current) => ({ ...current, [key]: value }));
  const toggleWorkoutDay = (day) => setWorkout((current) => ({ ...current, days: toggle(current.days, day) }));
  const updateTaper = (key, value) => setTaper((current) => ({ ...current, [key]: value }));
  return <section className="panel">
    <div className="section-heading"><h2>Build your system</h2><span>{settings.name}</span></div>
    <div className="form-grid">
      <label>System name<input value={settings.name} onChange={(e) => updateSettings("name", e.target.value)} /></label>
      <label>Wake time<input type="time" value={settings.wakeTime} onChange={(e) => updateSettings("wakeTime", e.target.value)} /></label>
      <label>Bedtime<input type="time" value={settings.bedtime} onChange={(e) => updateSettings("bedtime", e.target.value)} /></label>
    </div>
    <div className="mini-heading"><p>Modules</p><span>{Object.entries(settings.modules).filter(([, enabled]) => enabled).map(([key]) => key).join(", ")}</span></div>
    <div className="module-grid">{MODULES.map((module) => <button key={module} className={settings.modules[module] ? "module-button is-active" : "module-button"} onClick={() => toggleModule(module)}>{module}</button>)}</div>
    {settings.modules.Workout && <div className="subsection"><div className="mini-heading"><p>Workout planner</p><span>{workout.days.length} days</span></div><div className="day-toggle-grid compact">{DAYS.map((day) => <label className="check-pill" key={day}><input type="checkbox" checked={workout.days.includes(day)} onChange={() => toggleWorkoutDay(day)} />{day.slice(0, 3)}</label>)}</div><div className="form-grid workout-grid"><label>Workout time<input type="time" value={workout.time} onChange={(e) => updateWorkout("time", e.target.value)} /></label><label>Duration<input value={workout.duration} onChange={(e) => updateWorkout("duration", e.target.value)} /></label><label>Type<input value={workout.type} onChange={(e) => updateWorkout("type", e.target.value)} /></label><label>Location<input value={workout.location} onChange={(e) => updateWorkout("location", e.target.value)} /></label></div></div>}
    {settings.modules.Taper && <div className="subsection"><div className="mini-heading"><p>Taper plan</p><span>{fmtDate(taper.startDate)} to {fmtDate(taper.endDate)}</span></div><div className="form-grid"><label>Start date<input type="date" value={taper.startDate} onChange={(e) => updateTaper("startDate", e.target.value)} /></label><label>End date<input type="date" value={taper.endDate} onChange={(e) => updateTaper("endDate", e.target.value)} /></label><label>Weekly limit<input type="number" value={taper.targetAmount} onChange={(e) => updateTaper("targetAmount", e.target.value)} /></label><label>Unit<select value={taper.unit} onChange={(e) => updateTaper("unit", e.target.value)}>{["g", "mg", "hits", "sessions", "custom"].map((unit) => <option key={unit}>{unit}</option>)}</select></label><label>Duration goal<input type="time" value={taper.duration} onChange={(e) => updateTaper("duration", e.target.value)} /></label><label>Break target hours<input type="number" value={taper.breakHours} onChange={(e) => updateTaper("breakHours", e.target.value)} /></label></div></div>}
    <div className="action-row"><button className="primary-button" onClick={generateSystem}><Sparkles size={18} />Generate My System</button><button className="secondary-button" onClick={saveSystem}><Save size={18} />Save system</button></div>
  </section>;
}

function Plan({ tasks, logs, settings, taper, dates, summaries, taperProgress, range, setRange, month, setMonth, customRange, setCustomRange, viewMode, setViewMode, showMetrics, setShowMetrics, categoryFilter, setCategoryFilter, setSelectedDate }) {
  return <section className="panel system-panel">
    <div className="section-heading"><h2>Plan calendar</h2><span>{tasks.length ? `${tasks.length} blocks scheduled` : "Generate or add a block"}</span></div>
    {!tasks.length ? <div className="empty-state"><CalendarDays /><p>Generate a system or add a task to see the calendar.</p></div> : <>
      <div className="calendar-controls">
        <label>View Mode<select value={viewMode} onChange={(e) => setViewMode(e.target.value)}><option>System View</option><option>Log View</option></select></label>
        <label>Calendar range<select value={range} onChange={(e) => setRange(e.target.value)}>{RANGES.map((option) => <option key={option}>{option}</option>)}</select></label>
        {range === "Month" && <label>Month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>}
        {range === "Custom range" && <><label>Start<input type="date" value={customRange.start} onChange={(e) => setCustomRange((current) => ({ ...current, start: e.target.value }))} /></label><label>End<input type="date" value={customRange.end} onChange={(e) => setCustomRange((current) => ({ ...current, end: e.target.value }))} /></label></>}
        <label className="metrics-toggle"><input type="checkbox" checked={showMetrics} onChange={(e) => setShowMetrics(e.target.checked)} />Show metrics</label>
      </div>
      <label className="calendar-filter">Calendar module<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option>All</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      <div className="custom-calendar-scroll"><div className="custom-calendar">{LABELS.map((label) => <div key={label} className="calendar-column-head">{label}</div>)}{dates.map((date) => <CalendarCell key={date} date={date} tasks={tasks} logs={logs} settings={settings} taper={taper} categoryFilter={categoryFilter} viewMode={viewMode} showMetrics={showMetrics} setSelectedDate={setSelectedDate} />)}</div></div>
      <div className="weekly-summary"><article className="summary-card taper-summary-card"><h3>Taper progress</h3><p>{taperProgress.reduction}% reduction</p><span>{taperProgress.average}{taper.unit} avg daily use</span><span>{taperProgress.streak} day streak under limit</span><span>{taperProgress.suggestion}</span><span>If struggling, consider support or talking to someone you trust.</span></article>{summaries.map((summary) => <article className="summary-card" key={summary.label}><h3>{summary.label}</h3><p>{summary.completion}% complete</p><span>{summary.studyHours} study hrs</span><span>{summary.workoutHours} workout hrs</span><span>{summary.workouts} workouts</span></article>)}</div>
    </>}
  </section>;
}

function CalendarCell({ date, tasks, logs, taper, categoryFilter, viewMode, showMetrics, setSelectedDate }) {
  const dayTasks = tasksForDate(tasks, date).filter((task) => categoryFilter === "All" || task.category === categoryFilter);
  const log = { ...defaultLog, ...(logs[date] || {}) };
  const taperInfo = taperComparison(date, log, taper, logs);
  const status = hasUsage(log) ? taperInfo.status : dayStatus(log, dayTasks);
  return <button className={`calendar-cell ${STATUS_CLASS[status]}`} onClick={() => setSelectedDate(date)}><div className="cell-date"><span>{fmtCal(date)}</span><strong>{status}</strong></div>{viewMode === "System View" ? <div className="cell-blocks">{dayTasks.length ? dayTasks.slice(0, 5).map((task) => <p key={task.id}>{task.startTime && `${fmtTime(task.startTime)} `}{task.taskName}{metricSummary(task) && ` · ${metricSummary(task)}`}</p>) : <p className="cell-empty">No blocks</p>}</div> : <div className="cell-log"><p>{log.notes || "No notes yet"}</p></div>}{hasUsage(log) && <div className="taper-cell"><span>{Number(log.usage.amount) || 0}{taperInfo.unit} used today</span><span>{taperInfo.actual}{taperInfo.unit} / {taperInfo.limit}{taperInfo.unit} weekly</span></div>}{showMetrics && <div className="cell-metrics"><span>{plannedDuration(dayTasks)}</span></div>}</button>;
}

function AddTask({ newTask, setNewTask, addTask }) {
  return <section className="panel"><div className="section-heading"><h2>Add custom block</h2><span>Small and specific</span></div><form className="block-form" onSubmit={addTask}><label className="wide-field">Task name<input value={newTask.taskName} onChange={(e) => setNewTask((task) => ({ ...task, taskName: e.target.value }))} /></label><label>Start<input type="time" value={newTask.startTime} onChange={(e) => setNewTask((task) => ({ ...task, startTime: e.target.value }))} /></label><label>Duration<input value={newTask.duration} onChange={(e) => setNewTask((task) => ({ ...task, duration: e.target.value }))} /></label><label>Category<select value={newTask.category} onChange={(e) => setNewTask((task) => ({ ...task, category: e.target.value }))}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label>Metric<input value={newTask.metric} onChange={(e) => setNewTask((task) => ({ ...task, metric: e.target.value }))} /></label><label>Value<input value={newTask.metricValue} onChange={(e) => setNewTask((task) => ({ ...task, metricValue: e.target.value }))} /></label><label className="wide-field">Notes<textarea value={newTask.notes} onChange={(e) => setNewTask((task) => ({ ...task, notes: e.target.value }))} /></label><button className="primary-button wide-field"><Plus size={18} />Add block</button></form></section>;
}

function Saved({ saved, setSaved, loadSystem }) {
  return <section className="panel"><div className="section-heading"><h2>Saved systems</h2><span>{saved.length} total</span></div><div className="saved-list">{saved.map((item) => <div className="saved-system" key={item.id}><button onClick={() => loadSystem(item)}>{item.name}</button><button className="icon-button" onClick={() => setSaved((current) => current.filter((savedItem) => savedItem.id !== item.id))}><Trash2 size={15} /></button></div>)}</div></section>;
}

function DayModal({ date, log, tasks, taper, logs, close, updateLog, updateUsage, updateTaskStatus, updateMetricOverride }) {
  return <div className="modal-backdrop"><section className="day-modal"><div className="modal-heading"><div><p className="eyebrow">Day detail</p><h2>{fmtCal(date)}</h2></div><button className="icon-button" onClick={close}>Close</button></div><div className="modal-schedule"><h3>Full schedule</h3>{tasks.map((task) => <div className="modal-task" key={task.id}><time>{task.startTime}</time><div><p>{task.taskName}</p><span>{task.category} · {task.duration} · {metricSummary(task)}</span><label>Task status<select value={log.taskStatuses?.[task.id] || "No data"} onChange={(e) => updateTaskStatus(date, task.id, e.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label></div></div>)}</div><UsageLog log={log} date={date} taper={taper} logs={logs} updateUsage={updateUsage} /><label>Status<select value={log.status} onChange={(e) => updateLog(date, "status", e.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><details className="advanced-section"><summary>Advanced</summary><div className="advanced-body"><label>Notes<textarea value={log.notes} onChange={(e) => updateLog(date, "notes", e.target.value)} /></label><label>Manual adjustments<textarea value={log.manualTasks} onChange={(e) => updateLog(date, "manualTasks", e.target.value)} /></label>{tasks.map((task) => <label key={task.id}>Metric override: {task.taskName}<input value={log.metricOverrides?.[task.id] || ""} onChange={(e) => updateMetricOverride(date, task.id, e.target.value)} /></label>)}</div></details></section></div>;
}

function UsageLog({ log, date, taper, logs, updateUsage }) {
  const info = taperComparison(date, log, taper, logs);
  return <div className="usage-log-card"><div className="mini-heading"><p>Usage log</p><span>Weekly limit {info.limit}{info.unit} · Week used {info.actual}{info.unit}</span></div><div className={`taper-status ${STATUS_CLASS[info.status]}`}>{info.status}: {info.message}</div><div className="block-form"><label>Amount used<input type="number" value={log.usage.amount} onChange={(e) => updateUsage(date, "amount", e.target.value)} /></label><label>Unit<select value={log.usage.unit} onChange={(e) => updateUsage(date, "unit", e.target.value)}>{["g", "mg", "hits", "sessions", "custom"].map((unit) => <option key={unit}>{unit}</option>)}</select></label><label>Start time<input type="time" value={log.usage.startTime} onChange={(e) => updateUsage(date, "startTime", e.target.value)} /></label><label>End time<input type="time" value={log.usage.endTime} onChange={(e) => updateUsage(date, "endTime", e.target.value)} /></label><label>Sessions<input type="number" value={log.usage.sessions} onChange={(e) => updateUsage(date, "sessions", e.target.value)} /></label><label>Craving<select value={log.usage.craving} onChange={(e) => updateUsage(date, "craving", e.target.value)}>{[1, 2, 3, 4, 5].map((level) => <option key={level}>{level}</option>)}</select></label></div><div className="taper-progress"><div className="taper-progress-track"><div className={`taper-progress-fill ${STATUS_CLASS[info.status]}`} style={{ width: `${progressPct(info)}%` }} /></div><p>{info.actual}{info.unit} / {info.limit}{info.unit} weekly ({shortStatus(info.status)})</p></div><div className="taper-mini-stats"><span>Total duration: {info.duration}m</span><span>Since last use: {info.sinceLast}</span><span>Longest break: {info.longestBreak}</span><span>Sessions: {log.usage.sessions || 0}</span></div></div>;
}

function resolveRange(type, month, custom) { if (type === "Month") return monthRange(month); if (type === "Custom range") return { start: custom.start || todayISO(), end: custom.end || custom.start || todayISO() }; return { start: todayISO(), end: addDaysISO(todayISO(), 6) }; }
function buildDates({ start, end }) { const startDate = parseISO(start), endDate = parseISO(end); const low = startDate <= endDate ? startDate : endDate; const high = startDate <= endDate ? endDate : startDate; low.setDate(low.getDate() - low.getDay()); high.setDate(high.getDate() + (6 - high.getDay())); const count = Math.round((high - low) / 86400000) + 1; return Array.from({ length: count }, (_, index) => { const date = new Date(low); date.setDate(low.getDate() + index); return toISO(date); }); }
function monthRange(value) { const [year, month] = (value || todayISO().slice(0, 7)).split("-").map(Number); return { start: toISO(new Date(year, month - 1, 1)), end: toISO(new Date(year, month, 0)) }; }
function tasksForDate(tasks, date) { const day = dayName(date); return tasks.filter((task) => task.scheduleType === "One-time date" ? task.date === date : (task.repeatDays || []).includes(day)).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")); }
function dayStatus(log, tasks) { if (log.status && log.status !== "No data") return log.status; const statuses = tasks.map((task) => log.taskStatuses?.[task.id]).filter(Boolean).filter((status) => status !== "No data"); if (statuses.length && statuses.every((status) => status === "Completed")) return "Completed"; if (statuses.includes("Completed")) return "Partial"; if (statuses.includes("Missed")) return "Inconsistent"; return "No data"; }
function metricSummary(task) { if (!task.metric || task.metric === "None") return ""; return `${task.impactType || "Add"}${task.metricValue ? ` ${task.metricValue}` : ""} ${task.metric}`; }
function plannedDuration(tasks) { const minutes = tasks.reduce((sum, task) => sum + durationToMinutes(task.duration), 0); return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 6) / 10}h`; }
function taperComparison(date, log, taper, logs) { const usage = { ...defaultLog.usage, ...(log.usage || {}) }; const actual = weekDates(date).reduce((sum, day) => sum + (Number(logs[day]?.usage?.amount) || 0), 0); const limit = Number(taper.targetAmount) || 0; const ratio = limit > 0 ? actual / limit : actual > 0 ? 2 : 0; const status = !hasUsage(log) ? "No data" : ratio <= 0.85 ? "Completed" : ratio <= 1 ? "Partial" : ratio <= 1.25 ? "Inconsistent" : "Missed"; const unit = usage.unit || taper.unit; const duration = usageDuration(usage); return { actual: round(actual), limit, unit, duration, status, message: status === "Completed" ? "Under plan" : status === "Partial" ? "Close to limit" : status === "Inconsistent" ? "Slightly over plan" : status === "Missed" ? "Over plan" : "No usage logged", sinceLast: usage.endTime ? "Logged today" : "No end time", longestBreak: `${round(Math.max(0, 24 - duration / 60))}h / target ${taper.breakHours}h` }; }
function buildTaperProgress(dates, logs, taper) { const logged = dates.map((date) => ({ date, log: { ...defaultLog, ...(logs[date] || {}) } })).filter((day) => hasUsage(day.log)); const total = logged.reduce((sum, day) => sum + (Number(day.log.usage.amount) || 0), 0); const average = logged.length ? round(total / logged.length) : 0; const first = Number(logged[0]?.log.usage.amount) || 0; const reduction = first ? Math.max(0, Math.round(((first - average) / first) * 100)) : 0; const streak = longestUnder(dates, logs, taper); return { average, reduction, streak, suggestion: "Keep logging and aim for consistency." }; }
function weekSummaries(dates, tasks, logs) { const output = []; for (let index = 0; index < dates.length; index += 7) { const week = dates.slice(index, index + 7); const all = week.flatMap((date) => tasksForDate(tasks, date)); const complete = week.filter((date) => dayStatus({ ...defaultLog, ...(logs[date] || {}) }, tasksForDate(tasks, date)) === "Completed").length; output.push({ label: `${fmtDate(week[0])} - ${fmtDate(week[6])}`, completion: Math.round((complete / 7) * 100), studyHours: round(all.filter((task) => task.category === "Study").reduce((sum, task) => sum + durationToMinutes(task.duration), 0) / 60), workoutHours: round(all.filter((task) => task.category === "Workout").reduce((sum, task) => sum + durationToMinutes(task.duration), 0) / 60), workouts: all.filter((task) => task.category === "Workout").length }); } return output; }
function longestUnder(dates, logs, taper) { let best = 0, current = 0; dates.forEach((date) => { const log = { ...defaultLog, ...(logs[date] || {}) }; if (hasUsage(log) && ["Completed", "Partial"].includes(taperComparison(date, log, taper, logs).status)) { current += 1; best = Math.max(best, current); } else if (hasUsage(log)) current = 0; }); return best; }
function hasUsage(log) { return Number(log.usage?.amount) > 0 || Boolean(log.usage?.startTime || log.usage?.endTime); }
function progressPct(info) { return info.limit <= 0 ? (info.actual > 0 ? 100 : 0) : Math.min(100, Math.round((info.actual / info.limit) * 100)); }
function shortStatus(status) { return status === "Completed" ? "Under" : status === "Partial" ? "Near" : status === "Inconsistent" || status === "Missed" ? "Over" : "No data"; }
function usageDuration(usage) { if (!usage.startTime || !usage.endTime) return 0; const start = timeMin(usage.startTime), end = timeMin(usage.endTime); return end >= start ? end - start : 1440 - start + end; }
function durationToMinutes(value = "") { const number = parseFloat(value); if (Number.isNaN(number)) return 0; return /hr|hour/i.test(value) ? number * 60 : number; }
function shiftTime(value, minutes) { const [hour, minute] = value.split(":").map(Number); const date = new Date(); date.setHours(hour, minute + minutes, 0, 0); return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`; }
function weekDates(date) { const start = parseISO(date); start.setDate(start.getDate() - start.getDay()); return Array.from({ length: 7 }, (_, index) => { const current = new Date(start); current.setDate(start.getDate() + index); return toISO(current); }); }
function addDaysISO(value, days) { const date = parseISO(value); date.setDate(date.getDate() + days); return toISO(date); }
function parseISO(value) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
function toISO(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function fmtDate(value) { const date = parseISO(value); return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(2)}`; }
function fmtCal(value) { const date = parseISO(value); return `${date.getMonth() + 1}/${date.getDate()} ${LABELS[date.getDay()]}`; }
function fmtTime(value) { const [hour, minute] = value.split(":").map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`; }
function dayName(value) { return DAYS[parseISO(value).getDay()]; }
function timeMin(value) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function round(value) { return Math.round(value * 10) / 10; }
function toggle(array, item) { return array.includes(item) ? array.filter((value) => value !== item) : [...array, item]; }
function cap(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

createRoot(document.getElementById("root")).render(<App />);
