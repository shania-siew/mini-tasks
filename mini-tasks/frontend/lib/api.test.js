import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";
import { todayLocal } from "./date";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

function mockFetch(status, body) {
  const fn = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", fakeStorage({ token: "abc123" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api()", () => {
  it("sends the bearer token and JSON body", async () => {
    const fetchMock = mockFetch(200, { ok: true });
    await api("/tasks", "POST", { title: "x" });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer abc123");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.body).toBe(JSON.stringify({ title: "x" }));
  });

  it("joins FastAPI validation errors into one readable message", async () => {
    mockFetch(422, { detail: [{ msg: "title too short" }, { msg: "bad date" }] });
    await expect(api("/tasks", "POST", {})).rejects.toMatchObject({
      status: 422,
      message: "title too short; bad date",
    });
  });

  it("throws ApiError carrying the HTTP status, and handles 204", async () => {
    mockFetch(401, { detail: "Not authenticated" });
    await expect(api("/tasks")).rejects.toBeInstanceOf(ApiError);
    mockFetch(204, undefined);
    await expect(api("/tasks/1", "DELETE")).resolves.toBeUndefined();
  });
});

describe("todayLocal()", () => {
  it("formats the local date as YYYY-MM-DD with zero padding", () => {
    expect(todayLocal(new Date(2031, 2, 5, 23, 59))).toBe("2031-03-05");
  });
});
