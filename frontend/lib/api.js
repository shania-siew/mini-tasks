// Allowed values (kept here as documentation; the backend enforces them):
//   priority: "low" | "medium" | "high"
//   status:   "todo" | "in_progress" | "done"
// A task looks like:
//   { id, title, description, priority, status, due_date }   (due_date = "YYYY-MM-DD" or null)

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// NOTE: token lives in localStorage for simplicity (see README tradeoffs).
export const session = {
  token: () => (typeof window === "undefined" ? null : localStorage.getItem("token")),
  user: () => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  },
  save: (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },
};

export async function api(path, method = "GET", body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = session.token();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d) => d.msg).join("; ")
      : detail || "Something went wrong";
    throw new ApiError(res.status, msg);
  }
  return data;
}
