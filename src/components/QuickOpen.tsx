import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { editorStore, isBinaryImageFile } from "../stores/editor";
import { getFileIcon } from "./FileIcon";

interface FileSearchResult {
  path: string;
  rel_path: string;
  name: string;
}

interface CommandItem {
  id: string;
  category: string;
  title: string;
  shortcut?: string;
  icon: string;
  action: () => void;
}

export default function QuickOpen() {
  const {
    rootPath,
    loadFolder,
    closeFolder,
    isSearchOpen,
    closeSearch,
    searchMode,
    setSearchMode,
    openFile,
    setLoadingFilePath,
    newUntitledFile,
    closeActiveFile,
    closeAllFiles,
    closeOtherFiles,
    activeFilePath,
    isWordWrap,
    toggleWordWrap,
    toggleSidebar,
    canPreview,
    togglePreview,
    zoomIn,
    zoomOut,
    resetZoom,
    jumpTo,
    isVimMode,
    toggleVimMode,
    theme,
    toggleTheme,
    openFontModal,
    refreshExplorer,
    openSidebarView,
  } = editorStore;

  const [query, setQuery] = createSignal("");
  const [fileResults, setFileResults] = createSignal<FileSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;
  let debounceTimer: any = null;
  let fileSearchSeq = 0;

  async function openFileDialog() {
    const selected = await open({ multiple: false, directory: false });
    if (selected && typeof selected === "string") {
      const name = selected.split("/").pop() ?? selected.split("\\").pop() ?? selected;
      if (isBinaryImageFile(name)) {
        openFile(selected, name, "");
        return;
      }
      try {
        setLoadingFilePath(selected);
        const content = await invoke<string>("read_file", { path: selected });
        openFile(selected, name, content);
      } catch (err) {
        console.error("Failed to open file:", err);
      } finally {
        setLoadingFilePath(null);
      }
    }
  }

  async function openFolderDialog() {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      await loadFolder(selected);
    }
  }

  const allCommands = (): CommandItem[] => [
    {
      id: "file.new",
      category: "File",
      title: "New Untitled File",
      shortcut: "⌘N",
      icon: "codicon-new-file",
      action: () => {
        closeSearch();
        newUntitledFile();
      },
    },
    {
      id: "file.open",
      category: "File",
      title: "Open File...",
      shortcut: "⌘O",
      icon: "codicon-file",
      action: () => {
        closeSearch();
        openFileDialog();
      },
    },
    {
      id: "file.openFolder",
      category: "File",
      title: "Open Folder...",
      shortcut: "⌘K ⌘O",
      icon: "codicon-folder-opened",
      action: () => {
        closeSearch();
        openFolderDialog();
      },
    },
    {
      id: "file.closeFolder",
      category: "File",
      title: "Close Folder",
      icon: "codicon-folder",
      action: () => {
        closeSearch();
        closeFolder();
      },
    },
    {
      id: "file.close",
      category: "File",
      title: "Close Active Tab",
      shortcut: "⌘W",
      icon: "codicon-close",
      action: () => {
        closeSearch();
        closeActiveFile();
      },
    },
    {
      id: "file.closeOthers",
      category: "File",
      title: "Close Other Tabs",
      icon: "codicon-chrome-close",
      action: () => {
        closeSearch();
        const cur = activeFilePath();
        if (cur) closeOtherFiles(cur);
      },
    },
    {
      id: "file.closeAll",
      category: "File",
      title: "Close All Tabs",
      icon: "codicon-close-all",
      action: () => {
        closeSearch();
        closeAllFiles();
      },
    },
    {
      id: "view.wordWrap",
      category: "View",
      title: `Toggle Word Wrap (${isWordWrap() ? "Disable" : "Enable"})`,
      shortcut: "⌥Z",
      icon: "codicon-word-wrap",
      action: () => {
        closeSearch();
        toggleWordWrap();
      },
    },
    {
      id: "view.sidebar",
      category: "View",
      title: "Toggle Explorer Sidebar",
      shortcut: "⌘B",
      icon: "codicon-layout-sidebar-left",
      action: () => {
        closeSearch();
        toggleSidebar();
      },
    },
    {
      id: "view.preview",
      category: "View",
      title: "Toggle Live Preview (Markdown / HTML)",
      shortcut: "⌘⇧V",
      icon: "codicon-preview",
      action: () => {
        closeSearch();
        if (canPreview()) togglePreview();
      },
    },
    {
      id: "view.zoomIn",
      category: "View",
      title: "Zoom In / Increase Text Size",
      shortcut: "⌘=",
      icon: "codicon-zoom-in",
      action: () => {
        closeSearch();
        zoomIn();
      },
    },
    {
      id: "view.zoomOut",
      category: "View",
      title: "Zoom Out / Decrease Text Size",
      shortcut: "⌘-",
      icon: "codicon-zoom-out",
      action: () => {
        closeSearch();
        zoomOut();
      },
    },
    {
      id: "view.resetZoom",
      category: "View",
      title: "Reset Zoom / Default Text Size",
      shortcut: "⌘0",
      icon: "codicon-screen-normal",
      action: () => {
        closeSearch();
        resetZoom();
      },
    },
    {
      id: "nav.searchFiles",
      category: "Search",
      title: "Find in Files (Grep)",
      shortcut: "⌘⇧F",
      icon: "codicon-search",
      action: () => {
        closeSearch();
        openSidebarView("search");
      },
    },
    {
      id: "nav.gotoLine",
      category: "Go",
      title: "Go to Line...",
      shortcut: "⌘G",
      icon: "codicon-go-to-file",
      action: () => {
        setQuery(":");
      },
    },
    {
      id: "vim.toggle",
      category: "Vim",
      title: `Toggle Vim Mode (${isVimMode() ? "Disable" : "Enable"})`,
      icon: "codicon-terminal",
      action: () => {
        closeSearch();
        toggleVimMode();
      },
    },
    {
      id: "pref.theme",
      category: "Preferences",
      title: `Switch to ${theme() === "dark" ? "Light+" : "Dark+ (Obsidian)"} Theme`,
      icon: "codicon-color-mode",
      action: () => {
        closeSearch();
        toggleTheme();
      },
    },
    {
      id: "pref.fonts",
      category: "Preferences",
      title: "Configure Fonts & Text Size...",
      shortcut: "⌘,",
      icon: "codicon-settings-gear",
      action: () => {
        closeSearch();
        openFontModal();
      },
    },
    {
      id: "pref.refresh",
      category: "Explorer",
      title: "Refresh Explorer",
      icon: "codicon-refresh",
      action: () => {
        closeSearch();
        refreshExplorer();
      },
    },
  ];

  const currentMode = () => {
    const q = query();
    if (q.startsWith(">")) return "commands";
    if (q.startsWith(":")) return "goto";
    return searchMode() === "commands" ? "commands" : "files";
  };

  const filteredCommands = () => {
    let q = query().trim().toLowerCase();
    if (q.startsWith(">")) q = q.slice(1).trim();
    if (!q) return allCommands();
    return allCommands().filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  };

  createEffect(() => {
    if (isSearchOpen()) {
      if (searchMode() === "commands") {
        setQuery(">");
      } else {
        setQuery("");
      }
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef?.focus();
        inputRef?.select();
        if (searchMode() === "files") {
          runFileSearch("");
        }
      }, 30);
    }
  });

  function onInput(e: InputEvent) {
    const val = (e.target as HTMLInputElement).value;
    setQuery(val);
    setSelectedIndex(0);

    if (val.startsWith(">") || val.startsWith(":")) {
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runFileSearch(val);
    }, 60);
  }

  async function runFileSearch(q: string) {
    const root = rootPath();
    if (!root) {
      setFileResults([]);
      return;
    }

    // Monotonic id: a newer keystroke's results win; stale walks resolve
    // late and are dropped (backend also aborts them cooperatively).
    const seq = ++fileSearchSeq;
    setIsLoading(true);
    try {
      const results = await invoke<FileSearchResult[]>("find_files", {
        root,
        query: q,
        limit: 50,
      });
      if (seq !== fileSearchSeq) return;
      setFileResults(results);
    } catch (err) {
      if (seq !== fileSearchSeq) return;
      console.error("Search files error:", err);
      setFileResults([]);
    } finally {
      if (seq === fileSearchSeq) setIsLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isSearchOpen()) return;

    const mode = currentMode();
    const count =
      mode === "commands"
        ? filteredCommands().length
        : mode === "goto"
        ? 1
        : fileResults().length;

    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (count === 0) return;
      const next = (selectedIndex() + 1) % count;
      setSelectedIndex(next);
      scrollToIndex(next);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (count === 0) return;
      const prev = (selectedIndex() - 1 + count) % count;
      setSelectedIndex(prev);
      scrollToIndex(prev);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      selectCurrent();
      return;
    }

    if (e.key === "Backspace" && (query() === ">" || query() === ":")) {
      setSearchMode("files");
    }
  }

  function scrollToIndex(idx: number) {
    if (!listRef) return;
    const items = listRef.querySelectorAll(".quick-open-item");
    if (items[idx]) {
      (items[idx] as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }

  async function selectCurrent() {
    const mode = currentMode();

    if (mode === "commands") {
      const cmd = filteredCommands()[selectedIndex()];
      if (cmd) {
        cmd.action();
      }
      return;
    }

    if (mode === "goto") {
      const val = query().replace(/^:/, "").trim();
      const parts = val.split(/[:,\s]+/);
      const line = parseInt(parts[0], 10);
      const col = parts.length > 1 ? parseInt(parts[1], 10) : 1;
      if (!isNaN(line) && line > 0) {
        jumpTo(line, isNaN(col) ? 1 : col);
      }
      closeSearch();
      return;
    }

    // Files mode
    const item = fileResults()[selectedIndex()];
    if (item) {
      if (isBinaryImageFile(item.name)) {
        openFile(item.path, item.name, "");
        closeSearch();
        return;
      }
      try {
        setLoadingFilePath(item.path);
        const content = await invoke<string>("read_file", { path: item.path });
        openFile(item.path, item.name, content);
        closeSearch();
      } catch (err) {
        console.error("Open file error:", err);
      } finally {
        setLoadingFilePath(null);
      }
    } else if (query().trim()) {
      // No file matched: open in sidebar grep!
      openSidebarView("search", query().trim());
      closeSearch();
    }
  }

  onCleanup(() => {
    clearTimeout(debounceTimer);
  });

  return (
    <Show when={isSearchOpen()}>
      <div class="quick-open-overlay" onClick={closeSearch}>
        <div
          class="quick-open-widget"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Input Bar */}
          <div class="quick-open-input-container">
            <i
              class={`codicon ${
                currentMode() === "commands"
                  ? "codicon-terminal"
                  : currentMode() === "goto"
                  ? "codicon-go-to-file"
                  : "codicon-search"
              } quick-open-prompt-icon`}
            />
            <input
              ref={inputRef}
              class="quick-open-input"
              type="text"
              placeholder={
                currentMode() === "commands"
                  ? "Type a command or search actions..."
                  : currentMode() === "goto"
                  ? "Type line number to jump to..."
                  : "Search files by name (type > for commands, : for line)..."
              }
              value={query()}
              onInput={onInput}
            />
            <Show when={isLoading()}>
              <i class="codicon codicon-loading codicon-modifier-spin quick-open-spinner" />
            </Show>
          </div>

          {/* Results List */}
          <div ref={listRef} class="quick-open-list">
            {/* Mode 1: Commands */}
            <Show when={currentMode() === "commands"}>
              <For each={filteredCommands()}>
                {(cmd, i) => (
                  <div
                    class={`quick-open-item ${
                      selectedIndex() === i() ? "active" : ""
                    }`}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIndex(i())}
                  >
                    <div class="quick-open-item-main">
                      <i class={`codicon ${cmd.icon} quick-open-cmd-icon`} />
                      <span class="quick-open-category">{cmd.category}:</span>
                      <span class="quick-open-label">{cmd.title}</span>
                    </div>
                    <Show when={cmd.shortcut}>
                      <kbd class="quick-open-shortcut">{cmd.shortcut}</kbd>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={filteredCommands().length === 0}>
                <div class="quick-open-empty">No matching commands</div>
              </Show>
            </Show>

            {/* Mode 2: Go to Line */}
            <Show when={currentMode() === "goto"}>
              <div
                class="quick-open-item active"
                onClick={selectCurrent}
              >
                <div class="quick-open-item-main">
                  <i class="codicon codicon-go-to-file quick-open-cmd-icon" />
                  <span class="quick-open-label">
                    Press Enter to navigate to line {query().replace(/^:/, "") || "..."}
                  </span>
                </div>
              </div>
            </Show>

            {/* Mode 3: Files */}
            <Show when={currentMode() === "files"}>
              <For each={fileResults()}>
                {(item, i) => {
                  const iconInfo = getFileIcon(item.name);
                  return (
                    <div
                      class={`quick-open-item ${
                        selectedIndex() === i() ? "active" : ""
                      }`}
                      onClick={() => {
                        setSelectedIndex(i());
                        selectCurrent();
                      }}
                      onMouseEnter={() => setSelectedIndex(i())}
                    >
                      <div class="quick-open-item-main">
                        <span
                          class="quick-open-file-icon"
                          style={{ color: iconInfo.color }}
                        >
                          <i class={`codicon ${iconInfo.icon}`} />
                        </span>
                        <span class="quick-open-label">{item.name}</span>
                        <span class="quick-open-path">{item.rel_path}</span>
                      </div>
                    </div>
                  );
                }}
              </For>

              <Show when={fileResults().length === 0}>
                <div class="quick-open-empty-block">
                  <span class="quick-open-empty-text">
                    {rootPath()
                      ? isLoading()
                        ? "Searching files..."
                        : "No matching files"
                      : "Open a folder to browse files"}
                  </span>
                  <Show when={query().trim()}>
                    <button
                      class="quick-open-search-grep-btn"
                      onClick={() => {
                        openSidebarView("search", query().trim());
                        closeSearch();
                      }}
                    >
                      <i class="codicon codicon-search" />
                      <span>Search for "{query().trim()}" in files (⌘⇧F)</span>
                    </button>
                  </Show>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
