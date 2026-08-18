import { describe, expect, mock, test } from "bun:test";
import type { SubagentItemData } from "../src/ui/types.js";

function simulateMouseUp(
  event: { button: number; isDragging?: boolean; stopPropagation: () => void },
  item: SubagentItemData,
  onSelect: (id: string) => void
) {
  if (event.button === 0 && !event.isDragging) {
    event.stopPropagation();
    onSelect(item.id);
  }
}

describe("SubagentCard mouse selection and hover behavior", () => {
  const item: SubagentItemData = {
    id: "sub-123",
    parentID: "parent-1",
    title: "Test subagent",
    agent: "coder",
    status: "busy",
    createdTime: 1000,
    updatedTime: 2000,
    elapsedMs: 1000,
  };

  const theme = {
    textMuted: "#71717a",
    text: "#f4f4f5",
    primary: "#a855f7",
  };

  function getCardColors(isHovered: boolean, themeObj: typeof theme) {
    return {
      statusFg: isHovered ? themeObj.primary : themeObj.textMuted,
      agentFg: themeObj.text,
      titleFg: isHovered ? themeObj.text : themeObj.textMuted,
    };
  }

  test("uses muted text colors for status/title by default while agent remains theme text", () => {
    const colors = getCardColors(false, theme);
    expect(colors.statusFg).toBe("#71717a");
    expect(colors.agentFg).toBe("#f4f4f5");
    expect(colors.titleFg).toBe("#71717a");
  });

  test("promotes status and title colors when hovered while agent remains theme text", () => {
    const colors = getCardColors(true, theme);
    expect(colors.statusFg).toBe("#a855f7");
    expect(colors.agentFg).toBe("#f4f4f5");
    expect(colors.titleFg).toBe("#f4f4f5");
  });

  test("invokes onSelect and stops propagation for left click without drag", () => {
    const onSelect = mock();
    const stopPropagation = mock();

    simulateMouseUp({ button: 0, isDragging: false, stopPropagation }, item, onSelect);

    expect(onSelect).toHaveBeenCalledWith("sub-123");
    expect(stopPropagation).toHaveBeenCalled();
  });

  test("ignores right or middle clicks", () => {
    const onSelect = mock();
    const stopPropagation = mock();

    simulateMouseUp({ button: 1, isDragging: false, stopPropagation }, item, onSelect);
    simulateMouseUp({ button: 2, isDragging: false, stopPropagation }, item, onSelect);

    expect(onSelect).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  test("ignores drag end events", () => {
    const onSelect = mock();
    const stopPropagation = mock();

    simulateMouseUp({ button: 0, isDragging: true, stopPropagation }, item, onSelect);

    expect(onSelect).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });
});
