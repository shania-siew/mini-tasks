"use client";
import { useState } from "react";
import { api } from "@/lib/api";

// Props:
//   initial  - an existing task when editing (omit when creating)
//   onSubmit - async function receiving { title, description, priority, status, due_date }
//   onCancel - optional, shows a Cancel button
export default function TaskForm({ initial, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [status, setStatus] = useState(initial?.status ?? "todo");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  async function suggest() {
    setSuggesting(true);
    setError("");
    setHint("");
    try {
      const res = await api("/ai/suggest-due-date", "POST", { title, description });
      setDueDate(res.due_date);
      setHint(`Suggested: ${res.reason}`);
    } catch (err) {
      setError(err.message || "Suggestion failed");
    } finally {
      setSuggesting(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await onSubmit({ title, description, priority, status, due_date: dueDate || null });
      if (!initial) {
        setTitle("");
        setDescription("");
        setDueDate("");
        setHint("");
      }
    } catch (err) {
      setError(err.message || "Save failed");
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{initial ? "Edit task" : "New task"}</h2>
      <label>
        Title
        <input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Description
        <textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="row">
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </label>
        <label>
          Due date
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>
      <div className="row actions">
        <button type="button" onClick={suggest} disabled={suggesting || description.trim().length < 3}>
          {suggesting ? "Thinking…" : "✨ Suggest due date"}
        </button>
        <span className="grow" />
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
        <button className="primary">{initial ? "Save" : "Add task"}</button>
      </div>
      {hint && <p className="muted" aria-live="polite">{hint}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </form>
  );
}
