import { Show } from "solid-js";
import { editorStore } from "../stores/editor";

function formatLanguageName(lang: string): string {
  if (!lang) return "Plain Text";
  const map: Record<string, string> = {
    dockerfile: "Dockerfile",
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    markdown: "Markdown",
    rust: "Rust",
    cpp: "C++",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    yaml: "YAML",
    shell: "Shell",
    sql: "SQL",
    xml: "XML",
    java: "Java",
  };
  return map[lang.toLowerCase()] ?? lang;
}

export default function StatusBar() {
  const {
    activeFile,
    activeFilePath,
    isModified,
    cursorPosition,
    docLineCount,
    loadingFilePath,
    isVimMode,
    toggleVimMode,
    vimModeStatus,
    isWordWrap,
    toggleWordWrap,
    openGoToLine,
    gitBranch,
    isGitRepo,
    refreshGitStatus,
  } = editorStore;

  const cursorInfo = () => {
    const pos = cursorPosition();
    if (pos.selected > 0) {
      return `Ln ${pos.line}, Col ${pos.col} (${pos.selected} selected)`;
    }
    return `Ln ${pos.line}, Col ${pos.col}`;
  };

  // Live total from the editor view; falls back to stored content count
  // (e.g. before the view mounts).
  const totalLines = () => {
    const live = docLineCount();
    if (live > 1) return live;
    const file = activeFile();
    if (!file) return 0;
    const content = file.content;
    if (!content) return 1;
    let n = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) n++;
    }
    return n;
  };

  return (
    <div class="status-bar" aria-label="Document status">
      <div class="status-left">
        <Show when={isGitRepo() && gitBranch()}>
          <span
            class="status-item status-clickable status-branch"
            onClick={() => void refreshGitStatus()}
            title={`Git branch: ${gitBranch()} (Click to refresh status)`}
          >
            <i class="codicon codicon-git-branch" />
            <span>{gitBranch()}</span>
          </span>
        </Show>

        <Show when={loadingFilePath()}>
          <span class="status-item status-loading">
            <i class="codicon codicon-loading codicon-modifier-spin" />
            <span>Loading…</span>
          </span>
        </Show>

        <Show when={activeFilePath()}>
          <Show when={isModified(activeFilePath()!)}>
            <span class="status-item status-modified-pill" title="Unsaved changes">
              ●
            </span>
          </Show>
          <Show when={activeFile()?.isLarge}>
            <span
              class="status-item status-fast"
              title="High-Performance Mode: syntax features are reduced for large files."
            >
              ⚡ FAST
            </span>
          </Show>
        </Show>

        <span
          class={`status-item status-clickable status-vim-badge ${isVimMode() ? "active" : ""}`}
          onClick={toggleVimMode}
          title={`Vim Mode: ${isVimMode() ? "Enabled" : "Disabled"} (Click to toggle)`}
        >
          <Show when={isVimMode()} fallback={<span class="status-dim">VIM OFF</span>}>
            <span class={`status-vim-pill mode-${vimModeStatus().toLowerCase()}`}>
              {vimModeStatus()}
            </span>
          </Show>
        </span>

        <Show when={activeFile()}>
          <span class="status-item status-dim">
            {activeFile()!.isLarge ? "Plain Text" : formatLanguageName(activeFile()!.language)}
          </span>
        </Show>
      </div>

      <div class="status-right">
        <Show when={activeFilePath()}>
          <span
            class="status-item status-clickable"
            onClick={openGoToLine}
            title="Go to Line / Column (⌘G)"
          >
            {cursorInfo()}
          </span>
          <span class="status-item status-dim" title="Total lines in file">
            {totalLines()} lines
          </span>
          <span
            class="status-item status-clickable"
            onClick={toggleWordWrap}
            title="Toggle Word Wrap (⌥Z)"
          >
            {isWordWrap() ? "Wrap" : "No Wrap"}
          </span>
          <span class="status-item status-dim">UTF-8 · LF</span>
        </Show>
      </div>
    </div>
  );
}
