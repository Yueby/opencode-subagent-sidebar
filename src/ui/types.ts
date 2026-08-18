import type { SessionStatus } from "@opencode-ai/sdk/v2";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";

export interface SubagentItemData {
  id: string;
  parentID?: string;
  title: string;
  agent?: string;
  status: SessionStatus["type"];
  createdTime: number;
  updatedTime: number;
  elapsedMs: number;
}

export interface SubagentSidebarProps {
  api: TuiPluginApi;
  sessionId: string;
  version?: string;
}

export interface SubagentCardProps {
  item: SubagentItemData;
  theme: any;
  onSelect: (sessionID: string) => void;
}
