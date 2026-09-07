import { editorStore } from "../stores/editor";

export default function TitleBar() {
  const {
    isSidebarOpen,
    toggleSidebar,
    openSearch,
    activeFilePath,
    activeFile,
    rootPath,
    theme,
    toggleTheme,
    currentFont,
    openFontModal,
  } = editorStore;

  const centerLabel = () => {
    const root = rootPath();
    const file = activeFile();
    const folder = root ? root.split("/").pop() ?? root.split("\\").pop() : null;
    if (file && folder) {
      const rel = root && file.path.startsWith(root)
        ? file.path.slice(root.length).replace(/^[/\\]/, "")
        : file.name;
      return `${folder} — ${rel}`;
    }
    if (file) return file.name;
    if (folder) return folder;
    return "cmx editor";
  };

  return (
    <header class="titlebar" data-tauri-drag-region>
      {/* Left: macOS traffic lights space + files toggle + quick search switcher */}
      <div class="titlebar-left">
        <button
          class={`titlebar-btn ${isSidebarOpen() ? "active" : ""}`}
          onClick={toggleSidebar}
          title="Toggle Sidebar (⌘B)"
          aria-label="Toggle sidebar"
        >
          <i class="codicon codicon-layout-sidebar-left" />
        </button>

        <button
          class="titlebar-file-switch"
          onClick={() => openSearch("files")}
          title={activeFilePath() ?? "Quick Open (⌘P)"}
        >
          <i class="codicon codicon-go-to-file" />
          <span>{centerLabel()}</span>
          <kbd>⌘P</kbd>
        </button>
      </div>

      {/* Center flexible drag region */}
      <div class="titlebar-spacer" data-tauri-drag-region />

      {/* Right: global actions */}
      <div class="titlebar-right" role="toolbar" aria-label="Global actions">
        <button
          class="titlebar-btn"
          onClick={() => openSearch("commands")}
          title="Command Palette (⌘⇧P / F1)"
        >
          <i class="codicon codicon-terminal" />
        </button>
        <button
          class="titlebar-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme() === "dark" ? "Light" : "Dark"} theme`}
        >
          <i class="codicon codicon-color-mode" />
        </button>
        <button
          class="titlebar-btn"
          onClick={openFontModal}
          title={`Font & Text Size (Current: ${currentFont().name})`}
        >
          <i class="codicon codicon-settings-gear" />
        </button>
      </div>
    </header>
  );
}
