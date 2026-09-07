import { Show, onMount, onCleanup } from "solid-js";
import { editorStore } from "../stores/editor";

export default function ConfirmCloseModal() {
  const { pendingConfirmClose, handleConfirmCloseAction } = editorStore;

  function handleKeyDown(e: KeyboardEvent) {
    if (!pendingConfirmClose()) return;

    if (e.key === "Escape") {
      e.preventDefault();
      handleConfirmCloseAction("cancel");
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmCloseAction("save");
    } else if ((e.metaKey || e.altKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      handleConfirmCloseAction("discard");
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Show when={pendingConfirmClose()}>
      <div class="confirm-modal-overlay" onClick={() => handleConfirmCloseAction("cancel")}>
        <div class="confirm-modal" onClick={(e) => e.stopPropagation()}>
          <div class="confirm-modal-header">
            <div class="confirm-modal-icon-badge">
              <i class="codicon codicon-warning" />
            </div>
            <div class="confirm-modal-text">
              <h3 class="confirm-modal-title">
                Save changes to "{pendingConfirmClose()?.name}"?
              </h3>
              <p class="confirm-modal-subtitle">
                Your changes will be permanently lost if you close without saving.
              </p>
            </div>
          </div>

          <div class="confirm-modal-actions">
            <button
              class="confirm-btn confirm-btn-save"
              onClick={() => handleConfirmCloseAction("save")}
              title="Save changes and close (Enter)"
            >
              <i class="codicon codicon-save" />
              <span>Save</span>
              <kbd class="confirm-kbd">↵</kbd>
            </button>

            <button
              class="confirm-btn confirm-btn-discard"
              onClick={() => handleConfirmCloseAction("discard")}
              title="Discard changes and close (⌘D / ⌥D)"
            >
              <i class="codicon codicon-trash" />
              <span>Don't Save</span>
              <kbd class="confirm-kbd">⌘D</kbd>
            </button>

            <button
              class="confirm-btn confirm-btn-cancel"
              onClick={() => handleConfirmCloseAction("cancel")}
              title="Cancel (Esc)"
            >
              <span>Cancel</span>
              <kbd class="confirm-kbd">Esc</kbd>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
