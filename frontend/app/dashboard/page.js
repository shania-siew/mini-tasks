"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TaskForm from "@/components/TaskForm";
import { api, session } from "@/lib/api";
import { todayLocal } from "@/lib/date";

const STATUS_LABEL = { todo: "To do", in_progress: "In progress", done: "Done" };

export default function Dashboard() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [thisWeek, setThisWeek] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

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
    try {
      setTasks(await api(`/tasks?${params}`));
      setError("");
    } catch (err) {
      if (err.status === 401) return logout();
      setError(err.message || "Failed to load tasks");
    } finally {
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

  async function create(input) {
    await api("/tasks", "POST", input);
    await load();
  }

  async function update(id, input) {
    const updated = await api(`/tasks/${id}`, "PATCH", input);
    setTasks((ts) => ts.map((t) => (t.id === id ? updated : t)));
    setEditingId(null);
  }

  // Optimistic status change with rollback on failure
  async function changeStatus(task, status) {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await api(`/tasks/${task.id}`, "PATCH", { status });
    } catch {
      setTasks(prev);
      setError("Could not update status");
    }
  }

  // Optimistic delete with rollback on failure
  async function remove(task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    try {
      await api(`/tasks/${task.id}`, "DELETE");
    } catch {
      setTasks(prev);
      setError("Could not delete task");
    }
  }

  const today = todayLocal();

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
                {loading && <p className="muted">Loading…</p>}
                {!loading && tasks.length === 0 && <p className="muted">No tasks yet. Add one on the left.</p>}

                <ul className="tasks">
                  {tasks.map((t) =>
                    editingId === t.id ? (
                      <li key={t.id}>
                        <TaskForm initial={t} onSubmit={(input) => update(t.id, input)} onCancel={() => setEditingId(null)} />
                      </li>
                    ) : (
                      <li key={t.id} className={`card task ${t.status}`}>
                        <div className="grow">
                          <strong>{t.title}</strong> <span className={`badge ${t.priority}`}>{t.priority}</span>
                          {t.description && <p className="muted">{t.description}</p>}
                          {t.due_date && (
                            <small className={t.due_date < today && t.status !== "done" ? "error" : "muted"}>
                              Due {t.due_date}
                              {t.due_date < today && t.status !== "done" ? " (overdue)" : ""}
                            </small>
                          )}
                        </div>
                        <div className="row">
                          <select
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
                    )
                  )}
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}