import { createSignal } from "solid-js";
import type { JSX } from "@opentui/solid";
import type { SubagentCardProps } from "./types.js";
import { formatDuration, formatTaskTitle, getStatusDotColor, getStatusLabel } from "./utils.js";

export function SubagentCard(props: SubagentCardProps): JSX.Element {
  const [isHovered, setIsHovered] = createSignal(false);
  const status = () => getStatusLabel(props.item.status);

  const handleMouseUp = (event: any) => {
    if (event.button === 0 && !event.isDragging) {
      event.stopPropagation();
      props.onSelect(props.item.id);
    }
  };

  const dotFg = () => getStatusDotColor(props.item.status, props.theme);
  const durationFg = () => (isHovered() ? props.theme.primary : props.theme.textMuted);
  const titleFg = () => (isHovered() ? props.theme.text : props.theme.textMuted);

  return (
    <box
      flexDirection="column"
      width="100%"
      onMouseUp={handleMouseUp}
      onMouseOver={() => setIsHovered(true)}
      onMouseOut={() => setIsHovered(false)}
    >
      <box flexDirection="row" justifyContent="space-between" width="100%">
        <box flexDirection="row">
          <text fg={dotFg()} selectable={false}>
            {status().symbol}
          </text>
          <text fg={props.theme.text} selectable={false}>
            {" " + (props.item.agent ?? "subagent")}
          </text>
        </box>
        <text fg={durationFg()} selectable={false}>
          {formatDuration(props.item.elapsedMs)}
        </text>
      </box>
      <box paddingLeft={2} width="100%">
        <text fg={titleFg()} selectable={false}>
          {formatTaskTitle(props.item.title)}
        </text>
      </box>
    </box>
  );
}
