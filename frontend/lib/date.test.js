import { describe, expect, it } from "vitest";
import { daysUntil, describeDue, weekBounds } from "./date";

// 2031-03-05 is a Wednesday
const TODAY = "2031-03-05";

describe("describeDue()", () => {
  it("uses friendly wording near today", () => {
    expect(describeDue("2031-03-05", false, TODAY)).toEqual({ text: "Due today", tone: "soon" });
    expect(describeDue("2031-03-06", false, TODAY)).toEqual({ text: "Due tomorrow", tone: "soon" });
    expect(describeDue("2031-03-09", false, TODAY)).toEqual({ text: "Due in 4 days", tone: "normal" });
  });

  it("flags overdue tasks, but not finished ones", () => {
    expect(describeDue("2031-03-04", false, TODAY)).toEqual({ text: "Overdue by 1 day", tone: "overdue" });
    expect(describeDue("2031-03-02", false, TODAY).text).toBe("Overdue by 3 days");
    expect(describeDue("2031-03-02", true, TODAY).tone).toBe("muted");
  });
});

describe("daysUntil() and weekBounds()", () => {
  it("counts whole days across a month boundary", () => {
    expect(daysUntil("2031-04-01", "2031-03-30")).toBe(2);
  });

  it("returns Monday..Sunday for any day of the week", () => {
    expect(weekBounds("2031-03-05")).toEqual(["2031-03-03", "2031-03-09"]); // Wed
    expect(weekBounds("2031-03-03")).toEqual(["2031-03-03", "2031-03-09"]); // Mon
    expect(weekBounds("2031-03-09")).toEqual(["2031-03-03", "2031-03-09"]); // Sun
  });
});
