import { For, Show } from "solid-js";
import type { JSX } from "@opentui/solid";
import type { SubagentSidebarProps } from "./types.js";
import { useSubagentSessions } from "./useSubagentSessions.js";
import { SubagentCard } from "./SubagentCard.js";
import { getContrastForeground } from "./utils.js";
import { VERSION } from "../version.js";

export function SubagentSidebar(props: SubagentSidebarProps): JSX.Element {
  const sessions = useSubagentSessions(props.api, () => props.sessionId);
  const theme = () => props.api.theme.current;
  const version = () => props.version ?? VERSION;
  const badgeFg = () => getContrastForeground(theme().accent, theme().text, theme().background);

  return (
    <box flexDirection="column" padding={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between" alignItems="center" width="100%">
        <box paddingLeft={1} paddingRight={1} backgroundColor={theme().accent}>
          <text fg={badgeFg()}>
            <b>Subagent Sidebar</b>
          </text>
        </box>
        <text fg={theme().textMuted}>v{version()}</text>
      </box>
      <Show when={sessions.subagents().length > 0} fallback={<text fg={theme().textMuted}>No subagents for this session</text>}>
        <For each={sessions.subagents()}>
          {(item) => (
            <SubagentCard
              item={item}
              theme={theme()}
              onSelect={(sessionID) => sessions.navigate(sessionID)}
            />
          )}
        </For>
        <text fg={theme().textMuted}>Open a row from the command palette: “Open subagent …”</text>
      </Show>
    </box>
  );
}
