import { For, onCleanup, onMount, Show } from "solid-js";
import { editorStore, type FontOption } from "../stores/editor";

export default function FontSettingsModal() {
  const {
    isFontModalOpen,
    closeFontModal,
    fontOptions,
    currentFontId,
    setFontId,
    fontSize,
    setFontSize,
    zoomIn,
    zoomOut,
    resetZoom,
    tabSize,
    setTabSize,
    isVimMode,
    toggleVimMode,
  } = editorStore;

  let modalRef: HTMLDivElement | undefined;

  function handleClickOutside(e: MouseEvent) {
    if (isFontModalOpen() && modalRef && !modalRef.contains(e.target as Node)) {
      closeFontModal();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && isFontModalOpen()) {
      closeFontModal();
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

  const zoomPercent = () => Math.round((fontSize() / 13.5) * 100);

  return (
    <Show when={isFontModalOpen()}>
      <div class="font-modal-overlay">
        <div ref={modalRef} class="font-modal">
          {/* Modal Header */}
          <div class="font-modal-header">
            <div class="font-modal-title">
              <i class="codicon codicon-settings" />
              <span>Editor Settings & Preferences</span>
            </div>
            <button
              class="font-modal-close"
              onClick={closeFontModal}
              title="Close (Esc)"
            >
              <i class="codicon codicon-close" />
            </button>
          </div>

          <div class="font-modal-body">
            {/* Vim Mode Preference */}
            <div class="vim-toggle-row">
              <div class="vim-toggle-info">
                <span class="vim-toggle-title">
                  <i class="codicon codicon-terminal" />
                  Vim Keybindings
                </span>
                <span class="vim-toggle-desc">
                  Modal editing with standard motions, visual selection, and Ex commands (:w, :q)
                </span>
              </div>
              <label class="switch-control" title="Toggle Vim Mode">
                <input
                  type="checkbox"
                  checked={isVimMode()}
                  onChange={() => toggleVimMode()}
                />
                <span class="switch-slider" />
              </label>
            </div>

            {/* Section 1: Text Size Controls */}
            <div class="font-section">
              <div class="font-section-header">
                <span class="font-section-label">Text Size</span>
                <span class="font-size-badge">
                  {fontSize()}px ({zoomPercent()}%)
                </span>
              </div>

              <div class="font-size-row">
                <button
                  class="btn font-size-btn"
                  onClick={zoomOut}
                  title="Decrease font size (⌘-)"
                >
                  <i class="codicon codicon-dash" />
                </button>

                <input
                  type="range"
                  class="font-size-slider"
                  min="10"
                  max="26"
                  step="0.5"
                  value={fontSize()}
                  onInput={(e) =>
                    setFontSize(parseFloat((e.target as HTMLInputElement).value))
                  }
                />

                <button
                  class="btn font-size-btn"
                  onClick={zoomIn}
                  title="Increase font size (⌘+)"
                >
                  <i class="codicon codicon-add" />
                </button>

                <button
                  class="btn font-reset-btn"
                  onClick={resetZoom}
                  title="Reset to default 13.5px (⌘0)"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Section: Indentation (tab size in spaces) */}
            <div class="font-section">
              <div class="font-section-header">
                <span class="font-section-label">Tab Size</span>
                <span class="font-section-hint">
                  Spaces per indent level
                </span>
              </div>
              <div class="seg-row">
                {[2, 4, 8].map((n) => (
                  <button
                    class={`btn font-reset-btn seg-btn ${tabSize() === n ? "active" : ""}`}
                    onClick={() => setTabSize(n)}
                    title={`Indent with ${n} spaces`}
                  >
                    {n} spaces
                  </button>
                ))}
              </div>
            </div>

            {/* Section 2: Programming Monospace Fonts */}
            <div class="font-section font-section-spaced">
              <div class="font-section-header">
                <span class="font-section-label">Coding Monospace Fonts</span>
                <span class="font-section-hint">
                  Select for instant editor update
                </span>
              </div>

              <div class="font-list">
                <For each={fontOptions}>
                  {(font: FontOption) => {
                    const isSelected = () => font.id === currentFontId();
                    return (
                      <div
                        class={`font-card ${isSelected() ? "active" : ""}`}
                        onClick={() => setFontId(font.id)}
                      >
                        <div class="font-card-top">
                          <div class="font-card-info">
                            <span
                              class="font-card-name"
                              style={{ "font-family": font.css }}
                            >
                              {font.name}
                            </span>
                            <span class="font-card-desc">
                              {font.description}
                            </span>
                          </div>
                          <Show when={isSelected()}>
                            <span class="font-card-check">
                              <i class="codicon codicon-check" />
                            </span>
                          </Show>
                        </div>

                        {/* Live Code Preview */}
                        <div
                          class="font-preview-line"
                          style={{
                            "font-family": font.css,
                            "font-size": `${fontSize()}px`,
                          }}
                        >
                          <span class="preview-kw">const</span>{" "}
                          <span class="preview-fn">calculate</span> = (x:{" "}
                          <span class="preview-type">number</span>) =&gt; x * 2;{" "}
                          <span class="preview-cm">// ligatures: === != &lt;=</span>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>

          <div class="font-modal-footer">
            <span>Settings saved automatically</span>
            <span>Press <kbd>Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </Show>
  );
}
