import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { Session, SessionStatus } from "@opencode-ai/sdk/v2";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { SubagentItemData } from "./types.js";
import { durationForSession, isActiveSessionStatus } from "./utils.js";

export function useSubagentSessions(api: TuiPluginApi, parentSessionId: () => string) {
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [statuses, setStatuses] = createSignal(new Map<string, SessionStatus>());
  const [now, setNow] = createSignal(Date.now());
  let refreshGeneration = 0;

  const applyStatus = (sessionID: string, status: SessionStatus) => {
    setStatuses((current) => new Map(current).set(sessionID, status));
  };

  const refresh = async () => {
    const parentID = parentSessionId();
    const generation = ++refreshGeneration;
    if (!parentID) {
      setSessions([]);
      return;
    }
    try {
      const result = await api.client.session.children({ sessionID: parentID });
      if (generation === refreshGeneration && parentID === parentSessionId()) {
        setSessions(result.data ?? []);
      }
    } catch {
      if (generation === refreshGeneration && parentID === parentSessionId()) {
        setSessions([]);
      }
    }
  };

  const navigate = (sessionID: string) => api.route.navigate("session", { sessionID });

  onMount(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const unsubs = [
      api.event.on("session.created", (event) => {
        if (event.properties.info.parentID === parentSessionId()) void refresh();
      }),
      api.event.on("session.updated", (event) => {
        if (event.properties.info.parentID === parentSessionId()) void refresh();
      }),
      api.event.on("session.deleted", (event) => {
        setSessions((current) => current.filter((session) => session.id !== event.properties.sessionID));
        setStatuses((current) => {
          const next = new Map(current);
          next.delete(event.properties.sessionID);
          return next;
        });
      }),
      api.event.on("session.status", (event) => {
        applyStatus(event.properties.sessionID, event.properties.status);
      }),
      api.event.on("session.idle", (event) => {
        applyStatus(event.properties.sessionID, { type: "idle" });
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
    return sessions()
      .map((session) => {
        const status = currentStatuses.get(session.id)?.type ?? api.state.session.status(session.id)?.type ?? "idle";
        const createdTime = session.time?.created ?? now();
        const updatedTime = session.time?.updated ?? createdTime;
        return {
          id: session.id,
          parentID: session.parentID,
          title: session.title || session.id,
          agent: session.agent,
          status,
          createdTime,
          updatedTime,
          elapsedMs: durationForSession(session, status, now()),
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
