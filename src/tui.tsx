import type { TuiPlugin, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui";
import { SubagentSidebar } from "./ui/SubagentSidebar.js";

const tui: TuiPlugin = async (api) => {
  const slotPlugin: TuiSlotPlugin = {
    order: 899,
    slots: {
      sidebar_content: (_context, props) => <SubagentSidebar api={api} sessionId={props.session_id} />,
    },
  };
  api.slots.register(slotPlugin);
};

const plugin: TuiPluginModule = { id: "opencode-subagent-sidebar", tui };

export { tui };
export default plugin;
