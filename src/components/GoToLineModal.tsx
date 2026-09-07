import { createSignal, createEffect, Show } from "solid-js";
import { editorStore } from "../stores/editor";

export default function GoToLineModal() {
  const {
    isGoToLineOpen,
    closeGoToLine,
    jumpTo,
    cursorPosition,
    activeFile,
  } = editorStore;

  const [inputVal, setInputVal] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (isGoToLineOpen()) {
      setInputVal("");
      setTimeout(() => {
        inputRef?.focus();
        inputRef?.select();
      }, 40);
    }
  });

  function handleSubmit() {
    const val = inputVal().trim();
    if (!val) {
      closeGoToLine();
      return;
    }

    // Support "line:col" or "line,col" or just "line"
    const parts = val.split(/[:,\s]+/);
    const line = parseInt(parts[0], 10);
    const col = parts.length > 1 ? parseInt(parts[1], 10) : 1;

    if (!isNaN(line) && line > 0) {
      jumpTo(line, isNaN(col) || col <= 0 ? 1 : col);
    }
    closeGoToLine();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeGoToLine();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <Show when={isGoToLineOpen()}>
      <div class="goto-overlay" onClick={closeGoToLine}>
        <div
          class="goto-modal"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <div class="goto-header">
            <div class="goto-title">
              <i class="codicon codicon-go-to-file" />
              <span>Go to Line / Column</span>
            </div>
            <button
              class="goto-close"
              onClick={closeGoToLine}
              title="Close (Esc)"
            >
              <i class="codicon codicon-close" />
            </button>
          </div>

          <div class="goto-input-wrapper">
            <input
              ref={inputRef}
              class="goto-input"
              type="text"
              placeholder="e.g. 42 or 42:15"
              value={inputVal()}
              onInput={(e) => setInputVal((e.target as HTMLInputElement).value)}
            />
            <button class="goto-submit-btn" onClick={handleSubmit}>
              Go ↵
            </button>
          </div>

          <div class="goto-footer">
            <span class="goto-hint">
              Current: Ln {cursorPosition().line}, Col {cursorPosition().col}
            </span>
            <Show when={activeFile()}>
              <span class="goto-file-name">{activeFile()?.name}</span>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
