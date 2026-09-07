import { createEffect, onCleanup, onMount, Show } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { editorStore } from "./stores/editor";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import Editor from "./components/Editor";
import LivePreview from "./components/LivePreview";
import StatusBar from "./components/StatusBar";
import QuickOpen from "./components/QuickOpen";
import ContextMenu from "./components/ContextMenu";
import FontSettingsModal from "./components/FontSettingsModal";
import GoToLineModal from "./components/GoToLineModal";
import ConfirmCloseModal from "./components/ConfirmCloseModal";
import "./App.css";

// Variable fonts beyond the default load on demand (see effect below).
const loadedFontIds = new Set<string>(["jetbrains-mono"]);
function loadVariableFont(id: string): Promise<unknown> {
  switch (id) {
    case "fira-code":
      return import("@fontsource-variable/fira-code");
    case "source-code-pro":
      return import("@fontsource-variable/source-code-pro");
    default:
      // cascadia-code / sf-mono / consolas resolve to system fonts.
      return Promise.resolve();
  }
}

export default function App() {
  if (typeof window !== "undefined") (window as any).editorStore = editorStore;
  const {
    theme,
    fontSize,
    zoomIn,
    zoomOut,
    resetZoom,
    openSearch,
    isSearchOpen,
    closeSearch,
    canPreview,
    togglePreview,
    isSidebarOpen,
    toggleSidebar,
    openSidebarView,
    openFontModal,
    activeFilePath,
    closeFile,
    closeActiveFile,
    isGoToLineOpen,
    openGoToLine,
    closeGoToLine,
    toggleWordWrap,
  } = editorStore;

  // Theme swap: apply the attribute + freeze transitions/animations for one
  // frame so hover states don't smear from the old palette to the new one.
  // (The CodeMirror reconfigure in Editor.tsx runs in the same batch.)
  createEffect((prev: string | undefined) => {
    const mode = theme();
    document.documentElement.setAttribute("data-theme", mode);
    if (prev !== undefined && prev !== mode) {
      document.documentElement.classList.add("theme-swap");
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          document.documentElement.classList.remove("theme-swap")
        )
      );
    }
    return mode;
  });

  createEffect(() => {
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${fontSize()}px`
    );
  });

  createEffect(() => {
    document.documentElement.style.setProperty(
      "--editor-font-family",
      editorStore.currentFont().css
    );
    // Non-default variable fonts ship as async chunks and load on first
    // selection (JetBrains Mono is bundled with the initial CSS).
    const id = editorStore.currentFontId();
    if (!loadedFontIds.has(id)) {
      loadedFontIds.add(id);
      void loadVariableFont(id);
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    const isMod = e.metaKey || e.ctrlKey;

    // Explorer view shortcut (⌘⇧E)
    if (isMod && e.shiftKey && e.key.toLowerCase() === "e") {
      e.preventDefault();
      openSidebarView("explorer");
      return;
    }

    // Command Palette shortcut (⌘⇧P / Ctrl+Shift+P / F1)
    if ((isMod && e.shiftKey && e.key.toLowerCase() === "p") || e.key === "F1") {
      e.preventDefault();
      openSearch("commands");
      return;
    }

    // Go to Line shortcut (⌘G / Ctrl+G)
    if (isMod && e.key.toLowerCase() === "g") {
      e.preventDefault();
      openGoToLine();
      return;
    }

    // Toggle Word Wrap shortcut (Alt+Z / ⌥Z)
    if (e.altKey && (e.key.toLowerCase() === "z" || e.code === "KeyZ")) {
      e.preventDefault();
      toggleWordWrap();
      return;
    }

    // New file shortcut
    if (isMod && e.key.toLowerCase() === "n") {
      e.preventDefault();
      editorStore.newUntitledFile();
    }

    // Toggle Sidebar shortcut (⌘B)
    else if (isMod && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebar();
    }

    // Font & Text Size Settings shortcut (⌘,)
    else if (isMod && e.key === ",") {
      e.preventDefault();
      openFontModal();
    }

    // Search shortcuts
    else if (isMod && e.key.toLowerCase() === "p") {
      e.preventDefault();
      openSearch("files");
    } else if (isMod && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      openSearch("grep");
    } else if (isMod && e.shiftKey && e.key.toLowerCase() === "v") {
      if (canPreview()) {
        e.preventDefault();
        togglePreview();
      }
    } else if (e.key === "Escape") {
      // Esc dismisses modal UI only — the sidebar stays open (⌘B toggles it).
      if (isGoToLineOpen()) {
        closeGoToLine();
      } else if (isSearchOpen()) {
        closeSearch();
      }
    }

    // NOTE: ⌘W is intentionally NOT handled here — the native menu
    // (main.rs "CmdOrCtrl+W" -> "close-active-tab") is the single owner.
    // Handling it in the DOM too caused multiple tabs closing per keypress.

    // Zoom shortcuts: ⌘= / ⌘+ (Zoom In), ⌘- (Zoom Out), ⌘0 (Reset)
    else if (isMod && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      zoomIn();
    } else if (isMod && (e.key === "-" || e.key === "_")) {
      e.preventDefault();
      zoomOut();
    } else if (isMod && e.key === "0") {
      e.preventDefault();
      resetZoom();
    }
  }

  function handleWheel(e: WheelEvent) {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else if (e.deltaY > 0) {
        zoomOut();
      }
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    let unlistenCloseTab: (() => void) | undefined;
    listen("close-active-tab", () => {
      closeActiveFile();
    }).then((un) => {
      unlistenCloseTab = un;
    });

    onCleanup(() => {
      unlistenCloseTab?.();
    });
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("wheel", handleWheel);
  });

  return (
    <div class="app" data-theme={theme()}>
      <TitleBar />
      <div class="app-body">
        <Show when={isSidebarOpen()}>
          <Sidebar />
        </Show>
        <div class="main-panel">
          <TabBar />
          <div class="editor-workspace">
            <Editor />
            <LivePreview />
          </div>
        </div>
      </div>
      <StatusBar />
      <QuickOpen />
      <ContextMenu />
      <FontSettingsModal />
      <GoToLineModal />
      <ConfirmCloseModal />
    </div>
  );
}
