import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { Session, SessionStatus } from "@opencode-ai/sdk/v2";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { SubagentItemData } from "./types.js";
import { directChildren, durationForSession, formatTaskTitle, isActiveSessionStatus, latestTaskLabels, taskTimingForTitle } from "./utils.js";

export function useSubagentSessions(api: TuiPluginApi, parentSessionId: () => string) {
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [statuses, setStatuses] = createSignal(new Map<string, SessionStatus>());
  const [messageLabels, setMessageLabels] = createSignal(new Map<string, string>());
  const [now, setNow] = createSignal(Date.now());
  const taskTimings = new Map<string, { title: string; startTime: number }>();
  let refreshGeneration = 0;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let labelsParentID = "";

  const applyStatus = (sessionID: string, status: SessionStatus) => {
    setStatuses((current) => new Map(current).set(sessionID, status));
  };

  const isCurrentDirectChild = (sessionID: string, eventParentID?: string) => {
    const parentID = parentSessionId();
    if (!parentID) return false;
    return eventParentID === parentID || sessions().some((session) => session.id === sessionID && session.parentID === parentID);
  };

  const taskLabels = (parentID: string, children: readonly Session[]) => {
    const childIDs = new Set(children.map((child) => child.id));
    const parts = api.state.session.messages(parentID).flatMap((message) => api.state.part(message.id));
    return new Map([...latestTaskLabels(parts)].filter(([sessionID]) => childIDs.has(sessionID)));
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
      if (generation === refreshGeneration && parentID === parentSessionId()) {
        setSessions(children);
        setMessageLabels(taskLabels(parentID, children));
      }
    } catch {
      if (generation === refreshGeneration && parentID === parentSessionId()) {
        setSessions([]);
        setMessageLabels(new Map());
        taskTimings.clear();
      }
    }
  };

  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      void refresh();
    }, 200);
  };

  const navigate = (sessionID: string) => api.route.navigate("session", { sessionID });

  onMount(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const unsubs = [
      api.event.on("session.created", (event) => {
        if (isCurrentDirectChild(event.properties.sessionID, event.properties.info.parentID)) scheduleRefresh();
      }),
      api.event.on("session.deleted", (event) => {
        if (event.properties.sessionID === parentSessionId()) {
          setSessions([]);
          setStatuses(new Map());
          setMessageLabels(new Map());
          taskTimings.clear();
          return;
        }
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
      }),
      api.event.on("session.status", (event) => {
        applyStatus(event.properties.sessionID, event.properties.status);
      }),
      api.event.on("session.idle", (event) => {
        applyStatus(event.properties.sessionID, { type: "idle" });
      }),
      api.event.on("message.part.updated", (event) => {
        const parentID = parentSessionId();
        if (parentID && event.properties.sessionID === parentID && event.properties.part.type === "tool" && event.properties.part.tool === "task") {
          setMessageLabels(taskLabels(parentID, directChildren(sessions(), parentID)));
        }
      }),
    ];
    onCleanup(() => {
      clearInterval(timer);
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubs.forEach((unsubscribe) => unsubscribe());
      refreshGeneration++;
    });
  });

  createEffect(() => {
    parentSessionId();
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = undefined;
    }
    void refresh();
  });

  const commandItems = createMemo(() => {
    const parentID = parentSessionId();
    const currentStatuses = statuses();
    const labels = messageLabels();
    if (!parentID) return [];

    return directChildren(sessions(), parentID)
      .map((session) => ({
        id: session.id,
        title: formatTaskTitle(labels.get(session.id) || session.title || session.id),
        status: currentStatuses.get(session.id)?.type ?? api.state.session.status(session.id)?.type ?? "idle",
      }))
      .filter((session) => isActiveSessionStatus(session.status));
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
    const commands = commandItems().map((item, index) => ({
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
