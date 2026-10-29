// Date helpers. All dates are plain "YYYY-MM-DD" strings in the user's LOCAL timezone
// (new Date().toISOString() is UTC and can be a day off in the evening).

export function todayLocal(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Whole days from `today` until `iso` (negative = in the past)
export function daysUntil(iso, today = todayLocal()) {
  return Math.round((parseISODate(iso) - parseISODate(today)) / 86400000);
}

// Monday..Sunday of the week containing `todayISO` (mirrors the backend's "this week")
export function weekBounds(todayISO = todayLocal()) {
  const d = parseISODate(todayISO);
  const mondayOffset = (d.getDay() + 6) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return [todayLocal(start), todayLocal(end)];
}

// Friendly due-date text plus a tone the UI uses for colour: overdue | soon | normal | muted
export function describeDue(iso, done = false, today = todayLocal()) {
  const n = daysUntil(iso, today);
  const pretty = parseISODate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (done) return { text: `Due ${pretty}`, tone: "muted" };
  if (n < 0) return { text: `Overdue by ${-n} day${n === -1 ? "" : "s"}`, tone: "overdue" };
  if (n === 0) return { text: "Due today", tone: "soon" };
  if (n === 1) return { text: "Due tomorrow", tone: "soon" };
  if (n <= 6) return { text: `Due in ${n} days`, tone: "normal" };
  return { text: `Due ${pretty}`, tone: "normal" };
}
