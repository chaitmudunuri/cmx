import { createSignal, createRoot, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
  expanded?: boolean;
  loaded?: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isModified?: boolean;
  isLarge?: boolean;
  sizeBytes?: number;
}

export type SearchMode = "files" | "grep" | "commands";
export type SidebarView = "explorer" | "search";

export interface ConfirmCloseState {
  path: string;
  name: string;
  isUntitled: boolean;
}

export interface LineJumpTarget {
  line: number;
  col?: number;
}

export interface ContextMenuItem {
  label?: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  action?: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export interface FontOption {
  id: string;
  name: string;
  css: string;
  type: "monospace";
  description: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono",
    css: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
    type: "monospace",
    description: "Modern developer favorite with crisp ligatures & tall x-height",
  },
  {
    id: "fira-code",
    name: "Fira Code",
    css: "'Fira Code Variable', 'Fira Code', monospace",
    type: "monospace",
    description: "Iconic programmer font with rich multi-character code ligatures",
  },
  {
    id: "source-code-pro",
    name: "Source Code Pro",
    css: "'Source Code Pro Variable', 'Source Code Pro', monospace",
    type: "monospace",
    description: "Adobe's clean, highly-legible open-source coding monospace",
  },
  {
    id: "cascadia-code",
    name: "Cascadia Code",
    css: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
    type: "monospace",
    description: "Microsoft's modern terminal & VS Code programming font",
  },
  {
    id: "sf-mono",
    name: "SF Mono / Menlo",
    css: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    type: "monospace",
    description: "Apple macOS native developer monospace font",
  },
  {
    id: "consolas",
    name: "Consolas",
    css: "Consolas, 'Courier New', monospace",
    type: "monospace",
    description: "Classic high-clarity programming monospace",
  },
];

const STORAGE_THEME_KEY = "cmx_theme";
const STORAGE_ROOT_KEY = "cmx_root_path";
const STORAGE_FONT_KEY = "cmx_font_size";
const STORAGE_FONT_FAMILY_KEY = "cmx_font_family";
const STORAGE_VIM_KEY = "cmx_vim_mode";
const STORAGE_SIDEBAR_WIDTH_KEY = "cmx_sidebar_width";
const STORAGE_WORD_WRAP_KEY = "cmx_word_wrap";
const STORAGE_TAB_SIZE_KEY = "cmx_tab_size";
const STORAGE_SESSION_KEY = "cmx_session";

function createEditorStore() {
  const initialTheme =
    (localStorage.getItem(STORAGE_THEME_KEY) as "dark" | "light") || "dark";
  const initialRoot = localStorage.getItem(STORAGE_ROOT_KEY) || null;
  const initialFontSize =
    Number(localStorage.getItem(STORAGE_FONT_KEY)) || 13.5;
  const savedFontId =
    localStorage.getItem(STORAGE_FONT_FAMILY_KEY) || "jetbrains-mono";
  const initialFontId = FONT_OPTIONS.some((f) => f.id === savedFontId)
    ? savedFontId
    : "jetbrains-mono";
  const initialVim = localStorage.getItem(STORAGE_VIM_KEY) === "true";
  const initialSidebarWidth =
    Number(localStorage.getItem(STORAGE_SIDEBAR_WIDTH_KEY)) || 250;
  const initialWordWrap =
    localStorage.getItem(STORAGE_WORD_WRAP_KEY) !== "false";
  const initialTabSize =
    Number(localStorage.getItem(STORAGE_TAB_SIZE_KEY)) || 2;

  const [rootPath, setRootPath] = createSignal<string | null>(initialRoot);
  const [fileTree, setFileTree] = createStore<FileNode[]>([]);
  const [openFiles, setOpenFiles] = createStore<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = createSignal<string | null>(null);
  const [theme, setThemeState] = createSignal<"dark" | "light">(initialTheme);
  const [fontSize, setFontSizeState] = createSignal<number>(initialFontSize);
  const [currentFontId, setCurrentFontIdState] = createSignal<string>(initialFontId);
  const [isVimMode, setIsVimMode] = createSignal<boolean>(initialVim);
  const [vimModeStatus, setVimModeStatus] = createSignal<string>("NORMAL");
  const [sidebarWidth, setSidebarWidthState] = createSignal(initialSidebarWidth);
  const [isWordWrap, setIsWordWrap] = createSignal<boolean>(initialWordWrap);
  const [tabSize, setTabSizeState] = createSignal<number>(
    [2, 4, 8].includes(initialTabSize) ? initialTabSize : 2
  );
  const [isGoToLineOpen, setIsGoToLineOpen] = createSignal<boolean>(false);
  const [pendingConfirmClose, setPendingConfirmClose] = createSignal<ConfirmCloseState | null>(null);

  let saveActiveFileHandler: (() => Promise<boolean>) | null = null;
  function registerSaveHandler(fn: () => Promise<boolean>) {
    saveActiveFileHandler = fn;
  }

  function toggleWordWrap() {
    setIsWordWrap((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_WORD_WRAP_KEY, String(next));
      return next;
    });
  }

  function setWordWrap(enabled: boolean) {
    setIsWordWrap(enabled);
    localStorage.setItem(STORAGE_WORD_WRAP_KEY, String(enabled));
  }

  function setTabSize(n: number) {
    const v = [2, 4, 8].includes(n) ? n : 2;
    setTabSizeState(v);
    localStorage.setItem(STORAGE_TAB_SIZE_KEY, String(v));
  }

  function openGoToLine() {
    if (activeFilePath()) {
      setIsGoToLineOpen(true);
    }
  }

  function closeGoToLine() {
    setIsGoToLineOpen(false);
  }

  function jumpTo(line: number, col: number = 1) {
    setPendingLineJump({ line, col });
  }

  function setSidebarWidth(width: number) {
    const clamped = Math.min(800, Math.max(160, Math.round(width)));
    setSidebarWidthState(clamped);
    localStorage.setItem(STORAGE_SIDEBAR_WIDTH_KEY, String(clamped));
  }
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const [sidebarView, setSidebarView] = createSignal<SidebarView>("explorer");
  const [initialGrepQuery, setInitialGrepQuery] = createSignal<string>("");

  function openSidebarView(view: SidebarView, grepQuery?: string) {
    setSidebarView(view);
    if (!isSidebarOpen()) {
      setIsSidebarOpen(true);
    }
    if (grepQuery !== undefined) {
      setInitialGrepQuery(grepQuery);
    }
  }

  function toggleSidebarView(view: SidebarView) {
    if (isSidebarOpen() && sidebarView() === view) {
      setIsSidebarOpen(false);
    } else {
      setSidebarView(view);
      setIsSidebarOpen(true);
    }
  }

  const [isSearchOpen, setIsSearchOpen] = createSignal(false);
  const [searchMode, setSearchMode] = createSignal<SearchMode>("files");
  const [pendingLineJump, setPendingLineJump] = createSignal<LineJumpTarget | number | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = createSignal(false);
  const [isFontModalOpen, setIsFontModalOpen] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(null);
  const [cursorPosition, setCursorPosition] = createSignal({ line: 1, col: 1, selected: 0 });
  const [docLineCount, setDocLineCount] = createSignal(1);
  const [loadingFilePath, setLoadingFilePath] = createSignal<string | null>(null);

  function toggleVimMode() {
    setIsVimMode((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_VIM_KEY, String(next));
      return next;
    });
  }

  function setVimMode(enabled: boolean) {
    setIsVimMode(enabled);
    localStorage.setItem(STORAGE_VIM_KEY, String(enabled));
  }

  function openFontModal() {
    setIsFontModalOpen(true);
  }

  function closeFontModal() {
    setIsFontModalOpen(false);
  }

  function toggleSidebar() {
    setIsSidebarOpen((v) => !v);
  }

  function openContextMenu(x: number, y: number, items: ContextMenuItem[]) {
    setContextMenu({ x, y, items });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  async function deleteItem(path: string) {
    try {
      await invoke("delete_path", { path });
      // Close the file itself, plus any open files under a deleted folder.
      const doomed = openFiles.filter(
        (f) =>
          f.path === path ||
          f.path.startsWith(path + "/") ||
          f.path.startsWith(path + "\\")
      );
      for (const f of doomed) closeFile(f.path, true);
      removeTreeNode(path);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  async function renameItem(oldPath: string, newPath: string) {
    try {
      await invoke("rename_path", { oldPath, newPath });
      const name = newPath.split("/").pop() ?? newPath.split("\\").pop() ?? newPath;
      setOpenFiles(
        produce((files) => {
          const f = files.find((item) => item.path === oldPath);
          if (f) {
            f.path = newPath;
            f.name = name;
            f.language = detectLanguage(name);
          }
        })
      );
      if (activeFilePath() === oldPath) {
        setActiveFilePath(newPath);
      }
      renameTreeNode(oldPath, newPath);
    } catch (err) {
      console.error("Failed to rename:", err);
    }
  }

  async function revealItem(path: string) {
    try {
      await invoke("reveal_in_file_manager", { path });
    } catch (err) {
      console.error("Failed to reveal:", err);
    }
  }

  const currentFont = () =>
    FONT_OPTIONS.find((f) => f.id === currentFontId()) || FONT_OPTIONS[0];

  function setFontId(id: string) {
    setCurrentFontIdState(id);
    localStorage.setItem(STORAGE_FONT_FAMILY_KEY, id);
  }

  function cycleNextFont() {
    const idx = FONT_OPTIONS.findIndex((f) => f.id === currentFontId());
    const next = FONT_OPTIONS[(idx + 1) % FONT_OPTIONS.length];
    setFontId(next.id);
  }

  async function loadFolder(path: string) {
    try {
      const entries = await invoke<any[]>("list_dir", { path });
      setRootPath(path);
      localStorage.setItem(STORAGE_ROOT_KEY, path);
      setFileTree(
        entries.map((e: any) => ({
          name: e.name,
          path: e.path,
          isDir: e.is_dir,
          children: e.is_dir ? [] : undefined,
          expanded: false,
          loaded: false,
        }))
      );
    } catch (err) {
      console.warn("Could not reload folder:", err);
      localStorage.removeItem(STORAGE_ROOT_KEY);
      setRootPath(null);
    }
  }

  // ---- Incremental tree patching ----
  // Mutations patch fileTree in place so expanded/loaded subtrees survive
  // (a full loadFolder() reload collapses everything and refetches it all).

  function sortTreeNodes(nodes: FileNode[]) {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }

  function parentDirOf(path: string): string {
    const clean = path.replace(/[/\\]$/, "");
    const idx = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
    return idx === -1 ? "" : clean.substring(0, idx);
  }

  function basenameOf(path: string): string {
    return path.split("/").pop() ?? path.split("\\").pop() ?? path;
  }

  /** Insert a node under its parent dir (root level if parent is the root). */
  function upsertTreeNode(
    parentPath: string,
    entry: { name: string; path: string; isDir: boolean }
  ) {
    const node: FileNode = {
      name: entry.name,
      path: entry.path,
      isDir: entry.isDir,
      children: entry.isDir ? [] : undefined,
      expanded: false,
      loaded: false,
    };
    setFileTree(
      produce((nodes) => {
        const root = rootPath();
        if (root && parentPath === root) {
          if (!nodes.some((n) => n.path === node.path)) {
            nodes.push(node);
            sortTreeNodes(nodes);
          }
          return;
        }
        const insertInto = (list: FileNode[]): boolean => {
          for (const n of list) {
            if (n.path === parentPath && n.isDir) {
              n.children ??= [];
              if (!n.children.some((c) => c.path === node.path)) {
                n.children.push(node);
                sortTreeNodes(n.children);
              }
              n.loaded = true;
              n.expanded = true;
              return true;
            }
            if (n.isDir && n.children && insertInto(n.children)) return true;
          }
          return false;
        };
        if (!insertInto(nodes) && root && node.path.startsWith(root)) {
          // Parent subtree isn't loaded yet; fall back to a targeted refresh
          // of the root instead of silently dropping the node.
          void loadFolder(root);
        }
      })
    );
  }

  /** Remove a node (file or dir subtree) in place. */
  function removeTreeNode(path: string) {
    setFileTree(
      produce((nodes) => {
        const removeFrom = (list: FileNode[]): boolean => {
          const idx = list.findIndex((n) => n.path === path);
          if (idx !== -1) {
            list.splice(idx, 1);
            return true;
          }
          for (const n of list) {
            if (n.isDir && n.children && removeFrom(n.children)) return true;
          }
          return false;
        };
        removeFrom(nodes);
      })
    );
  }

  /** Rename a node in place; re-prefixes descendants when a dir moves. */
  function renameTreeNode(oldPath: string, newPath: string) {
    const newName = basenameOf(newPath);
    setFileTree(
      produce((nodes) => {
        const walk = (list: FileNode[]) => {
          for (const n of list) {
            if (n.path === oldPath) {
              n.path = newPath;
              n.name = newName;
            } else if (
              n.path.startsWith(oldPath + "/") ||
              n.path.startsWith(oldPath + "\\")
            ) {
              n.path = newPath + n.path.slice(oldPath.length);
            }
            if (n.isDir && n.children) walk(n.children);
          }
          sortTreeNodes(list);
        };
        walk(nodes);
      })
    );
  }

  /** Close the workspace folder. Open tabs are kept (absolute paths stay
   *  valid for editing/saving); the tree returns to the empty state. */
  function closeFolder() {
    batch(() => {
      setRootPath(null);
      localStorage.removeItem(STORAGE_ROOT_KEY);
      setFileTree([]);
    });
  }

  function setTheme(t: "dark" | "light") {
    setThemeState(t);
    localStorage.setItem(STORAGE_THEME_KEY, t);
  }

  function toggleTheme() {
    setTheme(theme() === "dark" ? "light" : "dark");
  }

  function setFontSize(size: number) {
    const clamped = Math.min(28, Math.max(10, Math.round(size * 10) / 10));
    setFontSizeState(clamped);
    localStorage.setItem(STORAGE_FONT_KEY, String(clamped));
  }

  function zoomIn() {
    setFontSize(fontSize() + 1);
  }

  function zoomOut() {
    setFontSize(fontSize() - 1);
  }

  function resetZoom() {
    setFontSize(13.5);
  }

  const activeFile = () => openFiles.find((f) => f.path === activeFilePath());

  const isFileOpen = (path: string) => openFiles.some((f) => f.path === path);

  const isModified = (path: string) => {
    const file = openFiles.find((f) => f.path === path);
    return file ? !!file.isModified : false;
  };

  function markFileModified(path: string, modified: boolean = true) {
    const idx = openFiles.findIndex((f) => f.path === path);
    if (idx !== -1 && openFiles[idx].isModified !== modified) {
      setOpenFiles(idx, "isModified", modified);
    }
  }

  let untitledCount = 0;

  function newUntitledFile() {
    untitledCount++;
    const name = `Untitled-${untitledCount}.txt`;
    const path = `untitled://${name}`;
    openFile(path, name, "");
  }

  async function createNewFileInFolder(folderPath: string, fileName: string) {
    const cleanPath = `${folderPath.replace(/[/\\]$/, "")}/${fileName.trim()}`;
    await invoke("create_file", { path: cleanPath });
    upsertTreeNode(folderPath, {
      name: fileName.trim(),
      path: cleanPath,
      isDir: false,
    });
    openFile(cleanPath, fileName.trim(), "");
  }

  async function createNewDirInFolder(folderPath: string, dirName: string) {
    const cleanPath = `${folderPath.replace(/[/\\]$/, "")}/${dirName.trim()}`;
    await invoke("create_dir", { path: cleanPath });
    upsertTreeNode(folderPath, {
      name: dirName.trim(),
      path: cleanPath,
      isDir: true,
    });
  }

  function saveSession() {
    try {
      const list = openFiles.map((f) => ({
        path: f.path,
        name: f.name,
        isUntitled: f.path.startsWith("untitled://"),
        content: f.path.startsWith("untitled://") ? f.content : undefined,
      }));
      localStorage.setItem(
        STORAGE_SESSION_KEY,
        JSON.stringify({
          openFiles: list,
          activeFilePath: activeFilePath(),
        })
      );
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  }

  /** Single doc classification (large-file threshold + byte size). */
  function classifyDoc(content: string) {
    const sizeBytes = content.length;
    // Large file threshold: >1.5MB or >25k lines
    const isLarge =
      sizeBytes > 1_500_000 || content.split("\n", 25_001).length > 25_000;
    return { sizeBytes, isLarge };
  }

  async function restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session || !Array.isArray(session.openFiles) || session.openFiles.length === 0) return;

      // Parallel restores: N concurrent read_file IPCs instead of N serial
      // round-trips. Order is preserved for tab order + active selection.
      const settled = await Promise.allSettled(
        session.openFiles.map(
          async (item: unknown): Promise<OpenFile | null> => {
            const path = typeof item === "string" ? item : (item as any)?.path;
            if (!path) return null;

            if (path.startsWith("untitled://")) {
              const content =
                (typeof item === "object" && (item as any).content) || "";
              const name =
                (typeof item === "object" && (item as any).name) ||
                path.replace("untitled://", "");
              return {
                path,
                name,
                content,
                language: detectLanguage(name),
                isModified: false,
                isLarge: false,
                sizeBytes: content.length,
              };
            }

            const name = path.split("/").pop() ?? path.split("\\").pop() ?? path;
            if (isBinaryImageFile(name)) {
              return {
                path,
                name,
                content: "",
                language: "image",
                isModified: false,
                isLarge: false,
                sizeBytes: 0,
              };
            }

            try {
              const content = await invoke<string>("read_file", { path });
              const { sizeBytes, isLarge } = classifyDoc(content);
              return {
                path,
                name,
                content,
                language: detectLanguage(name),
                isModified: false,
                isLarge,
                sizeBytes,
              };
            } catch (e) {
              console.warn(`Could not restore file ${path}:`, e);
              return null;
            }
          }
        )
      );

      const restored: OpenFile[] = [];
      for (const s of settled) {
        if (s.status === "fulfilled" && s.value) restored.push(s.value);
      }

      if (restored.length > 0) {
        batch(() => {
          setOpenFiles(restored);
          const targetActive = session.activeFilePath;
          if (targetActive && restored.some((f) => f.path === targetActive)) {
            setActiveFilePath(targetActive);
          } else {
            setActiveFilePath(restored[0].path);
          }
        });
      }
    } catch (err) {
      console.error("Failed to restore session:", err);
    }
  }

  // Restore saved folder & tabs session
  if (initialRoot) {
    loadFolder(initialRoot);
  }
  restoreSession();

  function openFile(path: string, name: string, content: string, targetLine?: LineJumpTarget | number) {
    const isImg = isBinaryImageFile(name);
    const { sizeBytes, isLarge } = isImg ? { sizeBytes: 0, isLarge: false } : classifyDoc(content);
    batch(() => {
      if (!isFileOpen(path)) {
        setOpenFiles(
          produce((files) => {
            files.push({
              path,
              name,
              content: isImg ? "" : content,
              language: isImg ? "image" : detectLanguage(name),
              isModified: false,
              isLarge,
              sizeBytes,
            });
          })
        );
      }
      setActiveFilePath(path);
      if (targetLine !== undefined && targetLine !== null) {
        setPendingLineJump(targetLine);
      }
    });
    saveSession();
  }

  function closeFile(path: string, force: boolean = false) {
    const file = openFiles.find((f) => f.path === path);
    if (!file) return;

    if (!force && file.isModified) {
      setPendingConfirmClose({
        path: file.path,
        name: file.name,
        isUntitled: file.path.startsWith("untitled://"),
      });
      return;
    }

    const idx = openFiles.findIndex((f) => f.path === path);
    if (idx === -1) return;

    const remaining = openFiles.filter((f) => f.path !== path);
    const wasActive = activeFilePath() === path;
    let nextActivePath: string | null = null;

    if (wasActive) {
      if (remaining.length > 0) {
        const nextIdx = Math.min(idx, remaining.length - 1);
        nextActivePath = remaining[nextIdx].path;
      } else {
        nextActivePath = null;
      }
    }

    batch(() => {
      setOpenFiles(remaining);
      if (wasActive) {
        setActiveFilePath(nextActivePath);
      }
    });

    saveSession();
  }

  function closeActiveFile(force: boolean = false) {
    const current = activeFilePath();
    if (current) {
      closeFile(current, force);
    }
  }

  async function handleConfirmCloseAction(action: "save" | "discard" | "cancel") {
    const target = pendingConfirmClose();
    if (!target) return;

    if (action === "cancel") {
      setPendingConfirmClose(null);
      return;
    }

    if (action === "discard") {
      setPendingConfirmClose(null);
      closeFile(target.path, true);
      return;
    }

    if (action === "save") {
      if (activeFilePath() !== target.path) {
        setActiveFilePath(target.path);
      }
      let saved = false;
      if (saveActiveFileHandler) {
        saved = await saveActiveFileHandler();
      }
      if (saved) {
        setPendingConfirmClose(null);
        closeFile(target.path, true);
      }
    }
  }

  function updateFileContent(path: string, content: string) {
    const idx = openFiles.findIndex((f) => f.path === path);
    if (idx !== -1) {
      setOpenFiles(idx, "content", content);
    }
  }

  function markFileSaved(path: string) {
    const idx = openFiles.findIndex((f) => f.path === path);
    if (idx !== -1) {
      setOpenFiles(idx, "isModified", false);
      saveSession();
    }
  }

  function openSearch(mode: SearchMode = "files", q?: string) {
    if (mode === "grep") {
      openSidebarView("search", q);
      setIsSearchOpen(false);
      return;
    }
    setSearchMode(mode);
    setIsSearchOpen(true);
  }

  function closeSearch() {
    setIsSearchOpen(false);
  }

  function closeOtherFiles(keepPath: string) {
    batch(() => {
      setOpenFiles(openFiles.filter((f) => f.path === keepPath));
      setActiveFilePath(keepPath);
    });
    saveSession();
  }

  function closeFilesToRight(targetPath: string) {
    const idx = openFiles.findIndex((f) => f.path === targetPath);
    if (idx === -1) return;
    const remaining = openFiles.slice(0, idx + 1);
    batch(() => {
      setOpenFiles(remaining);
      if (!remaining.some((f) => f.path === activeFilePath())) {
        setActiveFilePath(targetPath);
      }
    });
    saveSession();
  }

  function closeAllFiles() {
    batch(() => {
      setOpenFiles([]);
      setActiveFilePath(null);
    });
    saveSession();
  }

  async function refreshExplorer() {
    if (rootPath()) {
      await loadFolder(rootPath()!);
    }
  }

  return {
    rootPath,
    setRootPath,
    loadFolder,
    closeFolder,
    fileTree,
    setFileTree,
    upsertTreeNode,
    removeTreeNode,
    renameTreeNode,
    parentDirOf,
    openFiles,
    setOpenFiles,
    activeFilePath,
    setActiveFilePath,
    activeFile,
    isFileOpen,
    isModified,
    openFile,
    closeFile,
    newUntitledFile,
    createNewFileInFolder,
    createNewDirInFolder,
    updateFileContent,
    markFileModified,
    markFileSaved,
    loadingFilePath,
    setLoadingFilePath,
    theme,
    setTheme,
    toggleTheme,
    fontSize,
    setFontSize,
    zoomIn,
    zoomOut,
    resetZoom,
    fontOptions: FONT_OPTIONS,
    currentFontId,
    currentFont,
    setFontId,
    cycleNextFont,
    sidebarWidth,
    setSidebarWidth,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    sidebarView,
    setSidebarView,
    openSidebarView,
    toggleSidebarView,
    initialGrepQuery,
    setInitialGrepQuery,
    isSearchOpen,
    setIsSearchOpen,
    searchMode,
    setSearchMode,
    openSearch,
    closeSearch,
    pendingLineJump,
    setPendingLineJump,
    isPreviewOpen,
    setIsPreviewOpen,
    togglePreview: () => setIsPreviewOpen((v) => !v),
    isFontModalOpen,
    setIsFontModalOpen,
    openFontModal,
    closeFontModal,
    canPreview: () => {
      const file = activeFile();
      if (!file) return false;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      return ["md", "markdown", "html", "htm", "svg"].includes(ext);
    },
    previewType: () => {
      const file = activeFile();
      if (!file) return null;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (["md", "markdown"].includes(ext)) return "markdown";
      if (["html", "htm"].includes(ext)) return "html";
      if (ext === "svg") return "svg";
      return null;
    },
    contextMenu,
    openContextMenu,
    closeContextMenu,
    deleteItem,
    renameItem,
    revealItem,
    closeOtherFiles,
    closeFilesToRight,
    closeAllFiles,
    isWordWrap,
    toggleWordWrap,
    setWordWrap,
    tabSize,
    setTabSize,
    isGoToLineOpen,
    openGoToLine,
    closeGoToLine,
    jumpTo,
    pendingConfirmClose,
    handleConfirmCloseAction,
    registerSaveHandler,
    closeActiveFile,
    refreshExplorer,
    cursorPosition,
    setCursorPosition,
    docLineCount,
    setDocLineCount,
    isVimMode,
    toggleVimMode,
    setVimMode,
    vimModeStatus,
    setVimModeStatus,
  };
}
export const BINARY_IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "avif", "tiff"
]);

export function isBinaryImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return BINARY_IMAGE_EXTENSIONS.has(ext);
}

export function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return BINARY_IMAGE_EXTENSIONS.has(ext) || ext === "svg";
}

function detectLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  if (isBinaryImageFile(lower)) {
    return "image";
  }
  if (
    lower === "dockerfile" ||
    lower.startsWith("dockerfile.") ||
    lower.endsWith(".dockerfile")
  ) {
    return "dockerfile";
  }
  if (
    lower === "makefile" ||
    lower === "gnumakefile" ||
    lower.endsWith(".mk") ||
    lower === "cmakelists.txt" ||
    lower.startsWith(".env") ||
    lower === ".gitignore" ||
    lower === ".gitattributes"
  ) {
    return "shell";
  }

  const ext = lower.split(".").pop() ?? "";
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "javascript",
    tsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    html: "html",
    htm: "html",
    css: "css",
    scss: "css",
    less: "css",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    rs: "rust",
    c: "cpp",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    h: "cpp",
    hpp: "cpp",
    java: "java",
    go: "cpp",
    sql: "sql",
    xml: "xml",
    svg: "xml",
    yaml: "yaml",
    yml: "yaml",
    toml: "json",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    dockerfile: "dockerfile",
  };
  return langMap[ext] ?? "";
}

export const editorStore = createRoot(createEditorStore);
