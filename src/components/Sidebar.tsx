import { createSignal, onCleanup, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { editorStore, type FileNode, isBinaryImageFile } from "../stores/editor";
import { getFileIcon } from "./FileIcon";
import SidebarSearch from "./SidebarSearch";

export default function Sidebar() {
  const {
    rootPath,
    fileTree,
    setFileTree,
    toggleDirectory,
    newUntitledFile,
    createNewFileInFolder,
    createNewDirInFolder,
    openContextMenu,
    refreshExplorer,
    closeFolder,
    revealItem,
    sidebarWidth,
    setSidebarWidth,
    sidebarView,
    openSidebarView,
    isGitRepo,
    gitBranch,
    getFileGitStatus,
    getDirGitStatus,
    refreshGitStatus,
    openFolderDialog,
  } = editorStore;

  const [isDragging, setIsDragging] = createSignal(false);
  const [isCreatingFile, setIsCreatingFile] = createSignal(false);
  const [isCreatingDir, setIsCreatingDir] = createSignal(false);
  const [createTargetDir, setCreateTargetDir] = createSignal<string | null>(null);
  const [newItemName, setNewItemName] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  function handleResizerMouseDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    document.body.classList.add("is-resizing");

    const startX = e.clientX;
    const startWidth = sidebarWidth();

    function onMouseMove(moveEvent: MouseEvent) {
      const delta = moveEvent.clientX - startX;
      setSidebarWidth(startWidth + delta);
    }

    function onMouseUp() {
      setIsDragging(false);
      document.body.classList.remove("is-resizing");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  onCleanup(() => {
    document.body.classList.remove("is-resizing");
  });

  function handleStartNewFile(targetDir?: string) {
    if (!rootPath()) {
      newUntitledFile();
      return;
    }
    const target = targetDir || rootPath()!;
    setCreateTargetDir(target);
    setIsCreatingDir(false);
    setIsCreatingFile(true);
    setNewItemName("");
    setTimeout(() => inputRef?.focus(), 30);
  }

  function handleStartNewDir(targetDir?: string) {
    if (!rootPath()) return;
    const target = targetDir || rootPath()!;
    setCreateTargetDir(target);
    setIsCreatingFile(false);
    setIsCreatingDir(true);
    setNewItemName("");
    setTimeout(() => inputRef?.focus(), 30);
  }

  async function handleConfirmCreate() {
    const name = newItemName().trim();
    const target = createTargetDir() || rootPath();
    if (!name || !target) {
      setIsCreatingFile(false);
      setIsCreatingDir(false);
      setCreateTargetDir(null);
      return;
    }

    try {
      if (isCreatingFile()) {
        await createNewFileInFolder(target, name);
      } else if (isCreatingDir()) {
        await createNewDirInFolder(target, name);
      }
    } catch (err) {
      console.error("Creation error:", err);
    } finally {
      setIsCreatingFile(false);
      setIsCreatingDir(false);
      setCreateTargetDir(null);
      setNewItemName("");
    }
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmCreate();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsCreatingFile(false);
      setIsCreatingDir(false);
      setCreateTargetDir(null);
      setNewItemName("");
    }
  }

  function handleTreeContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    openContextMenu(e.clientX, e.clientY, [
      {
        label: "New File",
        icon: "codicon-new-file",
        shortcut: "⌘N",
        action: () => handleStartNewFile(),
      },
      {
        label: "New Folder",
        icon: "codicon-new-folder",
        action: () => handleStartNewDir(),
      },
      { separator: true },
      {
        label: "Refresh Explorer",
        icon: "codicon-refresh",
        action: () => refreshExplorer(),
      },
      ...(rootPath()
        ? [
            { separator: true },
            {
              label: "Copy Path",
              icon: "codicon-copy",
              action: () => navigator.clipboard.writeText(rootPath()!),
            },
            {
              label: "Reveal in Finder",
              icon: "codicon-folder-opened",
              action: () => revealItem(rootPath()!),
            },
            { separator: true },
            {
              label: "Close Folder",
              icon: "codicon-close",
              action: () => closeFolder(),
            },
          ]
        : []),
    ]);
  }

  return (
    <div
      class="sidebar"
      style={{
        width: `${sidebarWidth()}px`,
      }}
    >
      <div class="sidebar-tabs" role="tablist" aria-label="Sidebar views">
        <button
          role="tab"
          aria-selected={sidebarView() === "explorer"}
          class={`sidebar-tab ${sidebarView() === "explorer" ? "active" : ""}`}
          onClick={() => openSidebarView("explorer")}
          title="Explorer (⌘⇧E)"
        >
          <i class="codicon codicon-files" />
          <span>Files</span>
        </button>
        <button
          role="tab"
          aria-selected={sidebarView() === "search"}
          class={`sidebar-tab ${sidebarView() === "search" ? "active" : ""}`}
          onClick={() => openSidebarView("search")}
          title="Search (⌘⇧F)"
        >
          <i class="codicon codicon-search" />
          <span>Search</span>
        </button>
      </div>
      <Show
        when={sidebarView() === "explorer"}
        fallback={<SidebarSearch />}
      >
        <div class="sidebar-header">
          <div class="sidebar-title-group">
            <span class="sidebar-title">Explorer</span>
            <Show when={isGitRepo() && gitBranch()}>
              <span class="sidebar-branch-pill" title={`Git branch: ${gitBranch()}`}>
                <i class="codicon codicon-git-branch" />
                <span>{gitBranch()}</span>
              </span>
            </Show>
          </div>
          <div style="display: flex; gap: 2px;">
            <button
              onClick={() => handleStartNewFile()}
              title="New File (⌘N)"
            >
              <i class="codicon codicon-new-file" />
            </button>
            <Show when={rootPath()}>
              <button
                onClick={() => handleStartNewDir()}
                title="New Folder"
              >
                <i class="codicon codicon-new-folder" />
              </button>
              <button
                onClick={() => refreshExplorer()}
                title="Refresh Explorer"
              >
                <i class="codicon codicon-refresh" />
              </button>
              <button onClick={() => closeFolder()} title="Close Folder">
                <i class="codicon codicon-close" />
              </button>
            </Show>
            <button onClick={openFolderDialog} title="Open Folder (⌘⌥O)">
              <i class="codicon codicon-folder-opened" />
            </button>
          </div>
        </div>

        <div class="file-tree" onContextMenu={handleTreeContextMenu}>
          {/* Inline Input for New File or Folder at Root */}
          <Show
            when={
              (isCreatingFile() || isCreatingDir()) &&
              createTargetDir() === rootPath()
            }
          >
            <div class="tree-node inline-create-row" style="padding-left: 8px;">
              <span class="tree-icon">
                <Show
                  when={isCreatingDir()}
                  fallback={
                    <i
                      class={`codicon ${getFileIcon(newItemName() || "file.txt").icon}`}
                      style={{ color: getFileIcon(newItemName() || "file.txt").color }}
                    />
                  }
                >
                  <i class="codicon codicon-folder" style="color: #dcb67a;" />
                </Show>
              </span>
              <input
                ref={inputRef}
                class="inline-create-input"
                type="text"
                placeholder={isCreatingDir() ? "folder name..." : "filename.ext..."}
                value={newItemName()}
                onInput={(e) => setNewItemName((e.target as HTMLInputElement).value)}
                onKeyDown={handleInputKeyDown}
                onBlur={handleConfirmCreate}
              />
            </div>
          </Show>

          <Show
            when={rootPath()}
            fallback={
              <div class="sidebar-empty-state">
                <div class="sidebar-empty-icon">
                  <i class="codicon codicon-folder" />
                </div>
                <p class="sidebar-empty-title">No folder open</p>
                <div class="sidebar-empty-actions">
                  <button class="btn btn-primary" onClick={openFolderDialog}>
                    Open Folder
                  </button>
                  <button class="btn" onClick={() => newUntitledFile()}>
                    <i class="codicon codicon-new-file" />
                    New Untitled File
                  </button>
                </div>
              </div>
            }
          >
            <For each={fileTree}>
              {(node) => (
                <TreeNode
                  node={node}
                  depth={0}
                  createTargetDir={createTargetDir}
                  isCreatingFile={isCreatingFile}
                  isCreatingDir={isCreatingDir}
                  newItemName={newItemName}
                  setNewItemName={setNewItemName}
                  inputRef={inputRef}
                  handleInputKeyDown={handleInputKeyDown}
                  handleConfirmCreate={handleConfirmCreate}
                  onStartCreateFile={handleStartNewFile}
                  onStartCreateDir={handleStartNewDir}
                />
              )}
            </For>
          </Show>
        </div>
      </Show>

      {/* Resize Handle */}
      <div
        class={`sidebar-resizer ${isDragging() ? "is-resizing" : ""}`}
        onMouseDown={handleResizerMouseDown}
        onDblClick={() => setSidebarWidth(250)}
        title="Drag to resize sidebar (double-click to reset)"
      />
    </div>
  );
}

function TreeNode(props: {
  node: FileNode;
  depth: number;
  createTargetDir: () => string | null;
  isCreatingFile: () => boolean;
  isCreatingDir: () => boolean;
  newItemName: () => string;
  setNewItemName: (name: string) => void;
  inputRef?: HTMLInputElement;
  handleInputKeyDown: (e: KeyboardEvent) => void;
  handleConfirmCreate: () => void;
  onStartCreateFile: (folderPath: string) => void;
  onStartCreateDir: (folderPath: string) => void;
}) {
  const {
    rootPath,
    activeFilePath,
    setActiveFilePath,
    isFileOpen,
    openFile: storeOpenFile,
    setFileTree,
    toggleDirectory,
    openContextMenu,
    deleteItem,
    renameItem,
    revealItem,
    setLoadingFilePath,
  } = editorStore;

  const [isRenaming, setIsRenaming] = createSignal(false);
  const [renameVal, setRenameVal] = createSignal(props.node.name);
  let renameInputRef: HTMLInputElement | undefined;

  function startRename() {
    setIsRenaming(true);
    setRenameVal(props.node.name);
    setTimeout(() => {
      renameInputRef?.focus();
      renameInputRef?.select();
    }, 20);
  }

  async function handleConfirmRename() {
    const newName = renameVal().trim();
    if (!newName || newName === props.node.name) {
      setIsRenaming(false);
      return;
    }
    const lastSep = Math.max(
      props.node.path.lastIndexOf("/"),
      props.node.path.lastIndexOf("\\")
    );
    const parentDir = props.node.path.substring(0, lastSep);
    const sep = props.node.path.includes("\\") ? "\\" : "/";
    const newPath = `${parentDir}${sep}${newName}`;
    await renameItem(props.node.path, newPath);
    setIsRenaming(false);
  }

  function handleRenameKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsRenaming(false);
    }
  }

  async function handleClick() {
    if (props.node.isDir) {
      await toggleDir();
    } else {
      await openFileFromTree();
    }
  }

  async function toggleDir() {
    if (!props.node.loaded) {
      try {
        const entries = await invoke<any[]>("list_dir", {
          path: props.node.path,
        });
        const children: FileNode[] = entries.map((e) => ({
          name: e.name,
          path: e.path,
          isDir: e.is_dir,
          children: e.is_dir ? [] : undefined,
          expanded: false,
          loaded: false,
        }));
        toggleDirectory(props.node.path, children);
      } catch (e) {
        console.error("Failed to list dir:", e);
        toggleDirectory(props.node.path, []);
      }
    } else {
      toggleDirectory(props.node.path);
    }
  }

  async function openFileFromTree() {
    if (isFileOpen(props.node.path)) {
      setActiveFilePath(props.node.path);
      return;
    }
    if (isBinaryImageFile(props.node.name)) {
      storeOpenFile(props.node.path, props.node.name, "");
      return;
    }
    try {
      setLoadingFilePath(props.node.path);
      const content = await invoke<string>("read_file", {
        path: props.node.path,
      });
      storeOpenFile(props.node.path, props.node.name, content);
    } catch (e) {
      console.error("Failed to read file:", e);
    } finally {
      setLoadingFilePath(null);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const root = rootPath();
    const relPath =
      root && props.node.path.startsWith(root)
        ? props.node.path.slice(root.length).replace(/^[/\\]/, "")
        : props.node.name;

    if (props.node.isDir) {
      openContextMenu(e.clientX, e.clientY, [
        {
          label: "New File...",
          icon: "codicon-new-file",
          action: async () => {
            if (!props.node.expanded) {
              await toggleDir();
            }
            props.onStartCreateFile(props.node.path);
          },
        },
        {
          label: "New Folder...",
          icon: "codicon-new-folder",
          action: async () => {
            if (!props.node.expanded) {
              await toggleDir();
            }
            props.onStartCreateDir(props.node.path);
          },
        },
        { separator: true },
        {
          label: "Rename...",
          icon: "codicon-edit",
          shortcut: "Enter",
          action: () => startRename(),
        },
        {
          label: "Delete Folder",
          icon: "codicon-trash",
          danger: true,
          action: async () => {
            const ok = await confirm(
              `Are you sure you want to delete folder "${props.node.name}" and all its contents?`,
              { title: "Delete Folder", kind: "warning" }
            );
            if (ok) {
              await deleteItem(props.node.path);
            }
          },
        },
        { separator: true },
        {
          label: "Copy Path",
          icon: "codicon-copy",
          action: () => navigator.clipboard.writeText(props.node.path),
        },
        {
          label: "Copy Relative Path",
          icon: "codicon-files",
          action: () => navigator.clipboard.writeText(relPath),
        },
        {
          label: "Reveal in Finder",
          icon: "codicon-folder-opened",
          action: () => revealItem(props.node.path),
        },
      ]);
    } else {
      openContextMenu(e.clientX, e.clientY, [
        {
          label: "Open",
          icon: "codicon-go-to-file",
          action: () => openFileFromTree(),
        },
        { separator: true },
        {
          label: "Rename...",
          icon: "codicon-edit",
          shortcut: "Enter",
          action: () => startRename(),
        },
        {
          label: "Delete File",
          icon: "codicon-trash",
          danger: true,
          action: async () => {
            const ok = await confirm(
              `Are you sure you want to delete "${props.node.name}"?`,
              { title: "Delete File", kind: "warning" }
            );
            if (ok) {
              await deleteItem(props.node.path);
            }
          },
        },
        { separator: true },
        {
          label: "Copy Path",
          icon: "codicon-copy",
          action: () => navigator.clipboard.writeText(props.node.path),
        },
        {
          label: "Copy Relative Path",
          icon: "codicon-files",
          action: () => navigator.clipboard.writeText(relPath),
        },
        {
          label: "Reveal in Finder",
          icon: "codicon-folder-opened",
          action: () => revealItem(props.node.path),
        },
      ]);
    }
  }

  const isActive = () =>
    !props.node.isDir && activeFilePath() === props.node.path;

  const fileIconInfo = () => (!props.node.isDir ? getFileIcon(props.node.name) : null);
  const gitStatus = () => (!props.node.isDir ? getFileGitStatus(props.node.path) : undefined);
  const dirGitStatus = () => (props.node.isDir ? getDirGitStatus(props.node.path) : undefined);

  return (
    <>
      <div
        class={`tree-node ${isActive() ? "active" : ""}`}
        style={{ "padding-left": `${8 + props.depth * 12}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span class="tree-chevron">
          {props.node.isDir ? (
            <i
              class={`codicon ${
                props.node.expanded
                  ? "codicon-chevron-down"
                  : "codicon-chevron-right"
              }`}
            />
          ) : (
            <span class="tree-chevron-spacer" />
          )}
        </span>

        <span class="tree-icon">
          {props.node.isDir ? (
            <i
              class={`codicon tree-folder-icon ${
                props.node.expanded
                  ? "codicon-folder-opened"
                  : "codicon-folder"
              }`}
            />
          ) : (
            <i
              class={`codicon ${fileIconInfo()!.icon}`}
              style={{ color: fileIconInfo()!.color }}
            />
          )}
        </span>

        <Show
          when={isRenaming()}
          fallback={
            <span
              class={`tree-name ${
                gitStatus() ? `git-${gitStatus()!.status.toLowerCase()}` : ""
              }`}
            >
              {props.node.name}
            </span>
          }
        >
          <input
            ref={renameInputRef}
            class="inline-rename-input input-text"
            type="text"
            value={renameVal()}
            onInput={(e) => setRenameVal((e.target as HTMLInputElement).value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleConfirmRename}
            onClick={(e) => e.stopPropagation()}
          />
        </Show>

        <Show when={gitStatus()}>
          <span
            class={`git-status-badge git-status-${gitStatus()!.status.toLowerCase()}`}
            title={
              gitStatus()!.status === "M"
                ? gitStatus()!.staged
                  ? "Modified (Staged)"
                  : "Modified"
                : gitStatus()!.status === "U"
                ? "Untracked"
                : gitStatus()!.status === "A"
                ? "Added"
                : gitStatus()!.status === "D"
                ? "Deleted"
                : "Renamed"
            }
          >
            {gitStatus()!.status}
          </span>
        </Show>

        <Show when={dirGitStatus() && !props.node.expanded}>
          <span
            class={`git-dir-dot ${
              dirGitStatus()!.hasModified ? "git-dot-m" : "git-dot-u"
            }`}
            title={`${dirGitStatus()!.count} changed file${
              dirGitStatus()!.count > 1 ? "s" : ""
            }`}
          >
            ●
          </span>
        </Show>
      </div>

      <Show
        when={props.node.isDir && props.node.expanded}
      >
        {/* Inline Create Row inside this subfolder */}
        <Show
          when={
            (props.isCreatingFile() || props.isCreatingDir()) &&
            props.createTargetDir() === props.node.path
          }
        >
          <div
            class="tree-node inline-create-row"
            style={{ "padding-left": `${8 + (props.depth + 1) * 12}px` }}
          >
            <span class="tree-icon">
              <Show
                when={props.isCreatingDir()}
                fallback={
                  <i
                    class={`codicon ${getFileIcon(props.newItemName() || "file.txt").icon}`}
                    style={{
                      color: getFileIcon(props.newItemName() || "file.txt").color,
                    }}
                  />
                }
              >
                <i class="codicon codicon-folder tree-folder-icon" />
              </Show>
            </span>
            <input
              class="inline-create-input input-text"
              type="text"
              placeholder={props.isCreatingDir() ? "folder name..." : "filename.ext..."}
              value={props.newItemName()}
              onInput={(e) => props.setNewItemName((e.target as HTMLInputElement).value)}
              onKeyDown={props.handleInputKeyDown}
              onBlur={props.handleConfirmCreate}
              autofocus
            />
          </div>
        </Show>

        <Show when={props.node.children && props.node.children.length === 0 && !props.isCreatingFile() && !props.isCreatingDir()}>
          <div
            class="tree-node tree-empty-folder"
            style={{ "padding-left": `${8 + (props.depth + 1) * 12}px`, opacity: 0.5, "font-style": "italic", "user-select": "none", "font-size": "11.5px" }}
          >
            <span class="tree-name">No files in folder</span>
          </div>
        </Show>

        <Show when={props.node.children}>
          <For each={props.node.children}>
            {(child) => (
              <TreeNode
                node={child}
                depth={props.depth + 1}
                createTargetDir={props.createTargetDir}
                isCreatingFile={props.isCreatingFile}
                isCreatingDir={props.isCreatingDir}
                newItemName={props.newItemName}
                setNewItemName={props.setNewItemName}
                inputRef={props.inputRef}
                handleInputKeyDown={props.handleInputKeyDown}
                handleConfirmCreate={props.handleConfirmCreate}
                onStartCreateFile={props.onStartCreateFile}
                onStartCreateDir={props.onStartCreateDir}
              />
            )}
          </For>
        </Show>
      </Show>
    </>
  );
}
