import { For, onCleanup, onMount, Show } from "solid-js";
import { editorStore, type ContextMenuItem } from "../stores/editor";

export default function ContextMenu() {
  const { contextMenu, closeContextMenu } = editorStore;
  let menuRef: HTMLDivElement | undefined;

  function handleClickOutside(e: MouseEvent) {
    if (contextMenu() && menuRef && !menuRef.contains(e.target as Node)) {
      closeContextMenu();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && contextMenu()) {
      closeContextMenu();
    }
  }

  onMount(() => {
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("mousedown", handleClickOutside);
    window.removeEventListener("keydown", handleKeyDown);
  });

  const menuPos = () => {
    const cm = contextMenu();
    if (!cm) return { x: 0, y: 0 };
    // Prevent menu from overflowing window bounds
    const width = 190;
    const height = cm.items.length * 24 + 10;
    const x = Math.min(cm.x, window.innerWidth - width - 8);
    const y = Math.min(cm.y, window.innerHeight - height - 8);
    return { x: Math.max(8, x), y: Math.max(8, y) };
  };

  return (
    <Show when={contextMenu()}>
      <div
        ref={menuRef}
        class="context-menu"
        style={{
          top: `${menuPos().y}px`,
          left: `${menuPos().x}px`,
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <For each={contextMenu()!.items}>
          {(item) => (
            <Show
              when={!item.separator}
              fallback={<div class="context-menu-separator" />}
            >
              <div
                class={`context-menu-item ${item.danger ? "danger" : ""} ${
                  item.disabled ? "disabled" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!item.disabled && item.action) {
                    item.action();
                    closeContextMenu();
                  }
                }}
              >
                <div class="item-main">
                  <Show when={item.icon}>
                    <i class={`codicon ${item.icon}`} />
                  </Show>
                  <span>{item.label}</span>
                </div>
                <Show when={item.shortcut}>
                  <span class="item-shortcut">{item.shortcut}</span>
                </Show>
              </div>
            </Show>
          )}
        </For>
      </div>
    </Show>
  );
}
