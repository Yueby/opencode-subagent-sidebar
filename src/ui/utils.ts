import type { Session, SessionStatus } from "@opencode-ai/sdk/v2";

function parseColorToRgba(color: any): { r: number; g: number; b: number; a: number } | null {
  if (!color) return null;
  if (typeof color === "object") {
    const r = typeof color.r === "number" ? color.r : 0;
    const g = typeof color.g === "number" ? color.g : 0;
    const b = typeof color.b === "number" ? color.b : 0;
    const a = typeof color.a === "number" ? color.a : 1;
    const normR = r > 1 ? r / 255 : r;
    const normG = g > 1 ? g / 255 : g;
    const normB = b > 1 ? b / 255 : b;
    return { r: normR, g: normG, b: normB, a };
  }
  if (typeof color === "string" && color.startsWith("#")) {
    const hex = color.slice(1);
    let r = 0, g = 0, b = 0, a = 1;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
      if (hex.length === 4) a = parseInt(hex[3] + hex[3], 16) / 255;
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
      if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255;
    }
    return { r, g, b, a };
  }
  return null;
}

/**
 * Calculates a high-contrast foreground color for text on top of an accent background,
 * matching the exact helper used in installed omo-slim and magic-context TUI sidebars.
 */
export function getContrastForeground(accent: any, themeText: any, themeBackground: any): any {
  if (!accent) return themeText;
  const accentRgba = parseColorToRgba(accent);
  if (!accentRgba) return themeText;

  const luminance = 0.299 * accentRgba.r + 0.587 * accentRgba.g + 0.114 * accentRgba.b;
  if (luminance > 0.5) {
    if (themeBackground) {
      const bgRgba = parseColorToRgba(themeBackground);
      if (bgRgba && bgRgba.a !== 0) {
        const bgLum = 0.299 * bgRgba.r + 0.587 * bgRgba.g + 0.114 * bgRgba.b;
        if (bgLum < 0.5) {
          return themeBackground;
        }
      }
    }
    return "#000000";
  }
  if (themeText) {
    const textRgba = parseColorToRgba(themeText);
    if (textRgba) {
      const textLum = 0.299 * textRgba.r + 0.587 * textRgba.g + 0.114 * textRgba.b;
      if (textLum > 0.5) {
        return themeText;
      }
    }
  }
  return "#ffffff";
}

/**
 * Format elapsed milliseconds into concise, human-readable duration strings.
 * Examples: "12s", "1m 45s", "1h 12m"
 */
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0 || isNaN(ms)) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function durationForSession(
  session: Pick<Session, "time">,
  status: SessionStatus["type"],
  now: number,
): number {
  const created = session.time?.created ?? now;
  const updated = session.time?.updated ?? created;
  return Math.max(0, (isActiveSessionStatus(status) ? now : updated) - created);
}

export interface TaskTiming {
  title: string;
  startTime: number;
}

export function taskTimingForTitle(
  previous: TaskTiming | undefined,
  title: string,
  status: SessionStatus["type"] | undefined,
  createdTime: number,
  now: number,
): TaskTiming {
  if (!previous) {
    return { title, startTime: createdTime };
  }
  if (previous.title !== title) {
    return isActiveSessionStatus(status) ? { title, startTime: now } : previous;
  }
  return previous;
}

export function isActiveSessionStatus(status: SessionStatus["type"] | undefined): boolean {
  return status === "busy" || status === "retry";
}

export function directChildren<T extends Pick<Session, "id" | "parentID">>(
  sessions: readonly T[],
  parentID: string,
): T[] {
  return sessions.filter((session) => session.parentID === parentID);
}

export function formatTaskTitle(title: string): string {
  return title.replace(/\s+\(@[^\s()]+\s+subagent\)$/, "");
}

/**
 * Returns color token for session status dot matching OpenCode MCP sidebar conventions.
 */
export function getStatusDotColor(status: SessionStatus["type"] | undefined, theme: any): any {
  if (status === "busy") return theme.success ?? theme.accent;
  if (status === "retry") return theme.warning;
  return theme.textMuted;
}

/**
 * Normalizes session status string label.
 */
export function getStatusLabel(status: SessionStatus["type"] | undefined): {
  label: string;
  symbol: string;
} {
  switch (status) {
    case "busy":
    case "retry":
      return { label: "", symbol: "•" };
    case "idle":
    default:
      return { label: "", symbol: "•" };
  }
}
