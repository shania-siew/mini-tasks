"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import TaskForm from "@/components/TaskForm";
import { api, session } from "@/lib/api";
import { daysUntil, describeDue, todayLocal, weekBounds } from "@/lib/date";

const STATUS_LABEL = { todo: "To do", in_progress: "In progress", done: "Done" };
const UNDO_MS = 6000;

export default function Dashboard() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]); // filtered list shown on the right
  const [allTasks, setAllTasks] = useState([]); // everything, for the stats strip
  const [statusFilter, setStatusFilter] = useState("");
  const [thisWeek, setThisWeek] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState(null); // the task that was just deleted (for Undo)
  const toastTimer = useRef(null);

  const logout = useCallback(() => {
    session.clear();
    router.replace("/login");
  }, [router]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (thisWeek) {
      params.set("due_this_week", "true");
      params.set("today", todayLocal()); // server uses our local date for "this week"
    }
    // If the free-tier backend is asleep, the first request is slow: explain why
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    try {
      const everythingReq = api("/tasks");
      const filteredReq = statusFilter || thisWeek ? api(`/tasks?${params}`) : everythingReq;
      const [everything, filtered] = await Promise.all([everythingReq, filteredReq]);
      setAllTasks(everything);
      setTasks(filtered);
      setError("");
    } catch (err) {
      if (err.status === 401) return logout();
      setError(err.message || "Failed to load tasks");
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setLoading(false);
    }
  }, [statusFilter, thisWeek, logout]);

  useEffect(() => {
    if (!session.token()) {
      router.replace("/login");
      return;
    }
    setEmail(session.user()?.email ?? "");
  }, [router]);

  useEffect(() => {
    if (session.token()) load();
  }, [load]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  async function create(input) {
    await api("/tasks", "POST", input);
    await load();
  }

  async function update(id, input) {
    await api(`/tasks/${id}`, "PATCH", input);
    setEditingId(null);
    await load();
  }

  // Optimistic status change with rollback on failure
  async function changeStatus(task, status) {
    const prevList = tasks;
    const prevAll = allTasks;
    const apply = (ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t));
    setTasks(apply);
    setAllTasks(apply);
    try {
      await api(`/tasks/${task.id}`, "PATCH", { status });
    } catch {
      setTasks(prevList);
      setAllTasks(prevAll);
      setError("Could not update status");
    }
  }

  // Optimistic delete with rollback on failure, then an Undo toast.
  // Undo re-creates the task (it gets a new id; nothing else changes).
  async function remove(task) {
    const prevList = tasks;
    const prevAll = allTasks;
    const drop = (ts) => ts.filter((t) => t.id !== task.id);
    setTasks(drop);
    setAllTasks(drop);
    try {
      await api(`/tasks/${task.id}`, "DELETE");
    } catch {
      setTasks(prevList);
      setAllTasks(prevAll);
      setError("Could not delete task");
      return;
    }
    clearTimeout(toastTimer.current);
    setToast(task);
    toastTimer.current = setTimeout(() => setToast(null), UNDO_MS);
  }

  async function undoDelete() {
    if (!toast) return;
    const { title, description, priority, status, due_date } = toast;
    clearTimeout(toastTimer.current);
    setToast(null);
    try {
      await api("/tasks", "POST", { title, description, priority, status, due_date });
      await load();
    } catch {
      setError("Could not restore the task");
    }
  }

  const today = todayLocal();
  const [weekStart, weekEnd] = weekBounds(today);
  const stats = [
    { label: "Total", value: allTasks.length },
    { label: "In progress", value: allTasks.filter((t) => t.status === "in_progress").length },
    { label: "Done", value: allTasks.filter((t) => t.status === "done").length, tone: "good" },
    {
      label: "Due this week",
      value: allTasks.filter((t) => t.due_date && t.due_date >= weekStart && t.due_date <= weekEnd).length,
    },
    {
      label: "Overdue",
      value: allTasks.filter((t) => t.due_date && t.status !== "done" && daysUntil(t.due_date, today) < 0).length,
      tone: "bad",
    },
  ];

  return (
    <div className="dash-page">
      <header className="top-bar">
        <div className="top-inner">
          <div className="brand">
            {/* White checked-box logo (uses the text colour, so it is white in dark mode) */}
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="4.5" strokeWidth="2" />
              <path d="M8 12.5l3 3 5-6" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1>Mini Tasks</h1>
          </div>
          <div className="user">
            <span className="muted">{email}</span>
            <button onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="dash-body">
        <div className="dash-content">
          <section className="stats" aria-label="Task summary">
            {stats.map((s) => (
              <div key={s.label} className={`stat ${s.tone && s.value > 0 ? s.tone : ""}`}>
                <span className="stat-num">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </section>

          <div className="dashboard">
            <aside className="dash-form">
              <TaskForm onSubmit={create} />
            </aside>

            <section className="dash-list" aria-label="Your tasks">
              <div className="filters" role="group" aria-label="Filters">
                <label>
                  Status
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All</option>
                    <option value="todo">To do</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>
                <label className="check">
                  <input type="checkbox" checked={thisWeek} onChange={(e) => setThisWeek(e.target.checked)} />
                  Due this week
                </label>
              </div>

              <div className="tasks-scroll">
                {error && <p role="alert" className="error">{error}</p>}

                {loading && (
                  <>
                    {slow && (
                      <p className="notice" role="status">
                        Waking up the server… the first visit can take up to a minute on the free tier.
                      </p>
                    )}
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="card skeleton" aria-hidden="true" />
                    ))}
                  </>
                )}

                {!loading && tasks.length === 0 && (
                  <div className="empty">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="4.5" strokeWidth="1.6" />
                      <path d="M8 12.5l3 3 5-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p><strong>Nothing here yet</strong></p>
                    <p>
                      {statusFilter || thisWeek
                        ? "No tasks match these filters."
                        : "Add your first task using the form."}
                    </p>
                  </div>
                )}

                <ul className="tasks">
                  {tasks.map((t) => {
                    if (editingId === t.id) {
                      return (
                        <li key={t.id}>
                          <TaskForm initial={t} onSubmit={(input) => update(t.id, input)} onCancel={() => setEditingId(null)} />
                        </li>
                      );
                    }
                    const due = t.due_date ? describeDue(t.due_date, t.status === "done", today) : null;
                    return (
                      <li key={t.id} className={`card task p-${t.priority} ${t.status}`}>
                        <div className="grow">
                          <strong>{t.title}</strong> <span className={`badge ${t.priority}`}>{t.priority}</span>
                          {t.description && <p className="muted">{t.description}</p>}
                          {due && <small className={`due ${due.tone}`}>{due.text}</small>}
                        </div>
                        <div className="row">
                          <select
                            className={`status-select s-${t.status}`}
                            aria-label={`Status of ${t.title}`}
                            value={t.status}
                            onChange={(e) => changeStatus(t, e.target.value)}
                          >
                            {Object.keys(STATUS_LABEL).map((s) => (
                              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                          <button onClick={() => setEditingId(t.id)} aria-label={`Edit ${t.title}`}>Edit</button>
                          <button className="danger" onClick={() => remove(t)} aria-label={`Delete ${t.title}`}>Delete</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>Deleted “{toast.title}”</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}
    </div>
  );
}
