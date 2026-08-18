import { describe, expect, test } from "bun:test";
import type { Session } from "@opencode-ai/sdk/v2";
import { directChildren, durationForSession, formatDuration, formatTaskTitle, getContrastForeground, getStatusDotColor, getStatusLabel, isActiveSessionStatus, taskTimingForTitle } from "../src/ui/utils.js";

const session = (id: string, parentID?: string): Pick<Session, "id" | "parentID"> => ({ id, parentID });

describe("subagent helpers", () => {
  test("selects only direct children", () => {
    expect(directChildren([session("a", "root"), session("b"), session("c", "other")], "root")).toEqual([session("a", "root")]);
  });

  test("uses session creation time for active and updated time for idle sessions", () => {
    const value = { time: { created: 1_000, updated: 2_000 } } as Pick<Session, "time">;
    expect(durationForSession(value, "busy", 6_000)).toBe(5_000);
    expect(durationForSession(value, "retry", 6_000)).toBe(5_000);
    expect(durationForSession(value, "idle", 6_000)).toBe(1_000);
  });

  describe("taskTimingForTitle", () => {
    test("uses creation time for a newly observed active child", () => {
      expect(taskTimingForTitle(undefined, "First task", "busy", 1_000, 6_000)).toEqual({
        title: "First task",
        startTime: 1_000,
      });
    });

    test("resets when an active child's normalized title changes", () => {
      expect(taskTimingForTitle({ title: "First task", startTime: 1_000 }, "Second task", "busy", 1_000, 6_000)).toEqual({
        title: "Second task",
        startTime: 6_000,
      });
    });

    test("does not reset for unchanged active status or inactive title updates", () => {
      const previous = { title: "First task", startTime: 1_000 };
      expect(taskTimingForTitle(previous, "First task", "retry", 1_000, 6_000)).toEqual(previous);
      expect(taskTimingForTitle(previous, "Second task", "idle", 1_000, 6_000)).toEqual(previous);
    });

    test("resets when a title changes while idle and the child later becomes active", () => {
      const previous = { title: "First task", startTime: 1_000 };
      const whileIdle = taskTimingForTitle(previous, "Second task", "idle", 1_000, 4_000);
      expect(taskTimingForTitle(whileIdle, "Second task", "busy", 1_000, 6_000)).toEqual({
        title: "Second task",
        startTime: 6_000,
      });
    });

    test("compares normalized display titles rather than subagent markers", () => {
      const previous = { title: formatTaskTitle("First task (@one subagent)"), startTime: 1_000 };
      expect(taskTimingForTitle(previous, formatTaskTitle("First task (@two subagent)"), "busy", 1_000, 6_000)).toEqual(previous);
    });
  });

  test("includes only busy and retry sessions as active", () => {
    expect(isActiveSessionStatus("busy")).toBe(true);
    expect(isActiveSessionStatus("retry")).toBe(true);
    expect(isActiveSessionStatus("idle")).toBe(false);
    expect(isActiveSessionStatus(undefined)).toBe(false);
    expect(isActiveSessionStatus("unknown" as never)).toBe(false);
  });

  test("formats durations concisely", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(65_000)).toBe("1m 05s");
    expect(formatDuration(3_661_000)).toBe("1h 1m");
  });

  describe("formatTaskTitle", () => {
    test("strips trailing subagent marker with preceding space", () => {
      expect(formatTaskTitle("Refactor login flow (@a1b2 subagent)")).toBe("Refactor login flow");
      expect(formatTaskTitle("Fix UI bugs (@explore subagent)")).toBe("Fix UI bugs");
    });

    test("preserves titles without subagent marker or with legitimate parentheses", () => {
      expect(formatTaskTitle("Fix issue (v2.0)")).toBe("Fix issue (v2.0)");
      expect(formatTaskTitle("Search for (@something else)")).toBe("Search for (@something else)");
      expect(formatTaskTitle("Plain title")).toBe("Plain title");
    });
  });

  test("getStatusLabel returns bullet status symbol for all statuses", () => {
    expect(getStatusLabel("busy")).toEqual({ label: "", symbol: "•" });
    expect(getStatusLabel("retry")).toEqual({ label: "", symbol: "•" });
    expect(getStatusLabel("idle")).toEqual({ label: "", symbol: "•" });
  });

  test("getStatusDotColor maps busy to theme.success and retry to theme.warning", () => {
    const theme = { success: "#22c55e", warning: "#f59e0b", textMuted: "#71717a" };
    expect(getStatusDotColor("busy", theme)).toBe("#22c55e");
    expect(getStatusDotColor("retry", theme)).toBe("#f59e0b");
    expect(getStatusDotColor("idle", theme)).toBe("#71717a");
  });

  test("calculates contrast foreground color matching omo-slim / magic-context standard", () => {
    // Dark accent -> white text
    expect(getContrastForeground("#1e1b4b", "#ffffff", "#000000")).toBe("#ffffff");
    // Light accent with dark background -> theme background (inverse-of-panel look)
    expect(getContrastForeground("#fde047", "#000000", "#18181b")).toBe("#18181b");
  });
});
