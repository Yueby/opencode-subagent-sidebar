import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { Session, SessionStatus } from "@opencode-ai/sdk/v2";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { SubagentItemData } from "./types.js";
import { directChildren, durationForSession, formatTaskTitle, isActiveSessionStatus, taskTimingForTitle } from "./utils.js";

function extractLatestUserMessageText(response: unknown): string | undefined {
  if (!response || typeof response !== "object") return undefined;

  const data = (response as { data?: unknown }).data;
  if (!Array.isArray(data)) return undefined;

  for (let index = data.length - 1; index >= 0; index--) {
    const entry = data[index];
    if (!entry || typeof entry !== "object") continue;

    const info = (entry as { info?: unknown }).info;
    if (!info || typeof info !== "object" || (info as { role?: unknown }).role !== "user") continue;

    const parts = (entry as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;

    const text = parts
      .filter((part): part is { type: "text"; text: string; synthetic?: boolean } => {
        if (!part || typeof part !== "object") return false;
        const value = part as { type?: unknown; text?: unknown; synthetic?: unknown };
        return value.type === "text" && typeof value.text === "string" && value.synthetic !== true;
      })
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (text) return text;
  }

  return undefined;
}

export function useSubagentSessions(api: TuiPluginApi, parentSessionId: () => string) {
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [statuses, setStatuses] = createSignal(new Map<string, SessionStatus>());
  const [messageLabels, setMessageLabels] = createSignal(new Map<string, string>());
  const [now, setNow] = createSignal(Date.now());
  const taskTimings = new Map<string, { title: string; startTime: number }>();
  let refreshGeneration = 0;
  let labelsParentID = "";

  const applyStatus = (sessionID: string, status: SessionStatus) => {
    setStatuses((current) => new Map(current).set(sessionID, status));
  };

  const isCurrentDirectChild = (sessionID: string, eventParentID?: string) => {
    const parentID = parentSessionId();
    if (!parentID) return false;
    return eventParentID === parentID || sessions().some((session) => session.id === sessionID && session.parentID === parentID);
  };

  const refresh = async () => {
    const parentID = parentSessionId();
    const generation = ++refreshGeneration;
    if (parentID !== labelsParentID) {
      labelsParentID = parentID;
      setMessageLabels(new Map());
    }
    if (!parentID) {
      setSessions([]);
      setStatuses(new Map());
      taskTimings.clear();
      return;
    }
    try {
      const result = await api.client.session.children({ sessionID: parentID });
      const children = directChildren(result.data ?? [], parentID);
      const labels = new Map<string, string>();
      await Promise.all(
        children.map(async (child) => {
          try {
            const messages = await api.client.session.messages({ sessionID: child.id });
            const text = extractLatestUserMessageText(messages);
            if (text) labels.set(child.id, text);
          } catch {
            // A missing message must not prevent the other children from refreshing.
          }
        }),
      );
      if (generation === refreshGeneration && parentID === parentSessionId()) {
        setSessions(children);
        setMessageLabels(labels);
      }
    } catch {
      if (generation === refreshGeneration && parentID === parentSessionId()) {
        setSessions([]);
        setMessageLabels(new Map());
        taskTimings.clear();
      }
    }
  };

  const navigate = (sessionID: string) => api.route.navigate("session", { sessionID });

  onMount(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const unsubs = [
      api.event.on("session.created", (event) => {
        if (isCurrentDirectChild(event.properties.sessionID, event.properties.info.parentID)) void refresh();
      }),
      api.event.on("session.updated", (event) => {
        if (isCurrentDirectChild(event.properties.sessionID, event.properties.info.parentID)) void refresh();
      }),
      api.event.on("session.deleted", (event) => {
        const isCurrentChild = isCurrentDirectChild(event.properties.sessionID, event.properties.info.parentID);
        setSessions((current) => current.filter((session) => session.id !== event.properties.sessionID));
        setStatuses((current) => {
          const next = new Map(current);
          next.delete(event.properties.sessionID);
          return next;
        });
        setMessageLabels((current) => {
          const next = new Map(current);
          next.delete(event.properties.sessionID);
          return next;
        });
        taskTimings.delete(event.properties.sessionID);
        if (isCurrentChild) void refresh();
      }),
      api.event.on("session.status", (event) => {
        applyStatus(event.properties.sessionID, event.properties.status);
        if (isCurrentDirectChild(event.properties.sessionID)) void refresh();
      }),
      api.event.on("session.idle", (event) => {
        applyStatus(event.properties.sessionID, { type: "idle" });
        if (isCurrentDirectChild(event.properties.sessionID)) void refresh();
      }),
    ];
    onCleanup(() => {
      clearInterval(timer);
      unsubs.forEach((unsubscribe) => unsubscribe());
      refreshGeneration++;
    });
  });

  createEffect(() => {
    parentSessionId();
    void refresh();
  });

  const subagents = createMemo<SubagentItemData[]>(() => {
    const currentStatuses = statuses();
    const currentNow = now();
    const parentID = parentSessionId();
    const currentSessions = parentID ? directChildren(sessions(), parentID) : [];
    const currentSessionIDs = new Set(currentSessions.map((session) => session.id));
    for (const sessionID of taskTimings.keys()) {
      if (!currentSessionIDs.has(sessionID)) taskTimings.delete(sessionID);
    }

    return currentSessions
      .map((session) => {
        const status = currentStatuses.get(session.id)?.type ?? api.state.session.status(session.id)?.type ?? "idle";
        const createdTime = session.time?.created ?? currentNow;
        const updatedTime = session.time?.updated ?? createdTime;
        const title = formatTaskTitle(messageLabels().get(session.id) || session.title || session.id);
        const timing = taskTimingForTitle(taskTimings.get(session.id), title, status, createdTime, currentNow);
        taskTimings.set(session.id, timing);
        return {
          id: session.id,
          parentID: session.parentID,
          title,
          agent: session.agent,
          status,
          createdTime,
          updatedTime,
          elapsedMs: isActiveSessionStatus(status)
            ? Math.max(0, currentNow - timing.startTime)
            : durationForSession(session, status, currentNow),
        };
      })
      .filter((item) => isActiveSessionStatus(item.status))
      .sort((a, b) => a.createdTime - b.createdTime);
  });

  createEffect(() => {
    const commands = subagents().map((item, index) => ({
      name: `subagent.open.${item.id}`,
      title: `Open subagent ${index + 1}: ${item.title}`,
      category: "Subagents",
      namespace: "palette",
      run: () => navigate(item.id),
    }));
    const unregister = api.keymap.registerLayer({ commands });
    onCleanup(() => unregister());
  });

  onCleanup(() => {
    refreshGeneration++;
  });

  return { subagents, activeCount: createMemo(() => subagents().length), refresh, navigate };
}
