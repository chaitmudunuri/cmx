import { For, Show } from "solid-js";
import { editorStore, type OpenFile } from "../stores/editor";
import { getFileIcon } from "./FileIcon";

export default function TabBar() {
  const {
    rootPath,
    openFiles,
    activeFilePath,
    setActiveFilePath,
    closeFile,
    closeOtherFiles,
    closeFilesToRight,
    closeAllFiles,
    newUntitledFile,
    isModified,
    canPreview,
    isPreviewOpen,
    togglePreview,
    openContextMenu,
    revealItem,
  } = editorStore;

  function handleClose(e: MouseEvent, path: string) {
    e.stopPropagation();
    closeFile(path);
  }

  function handleTabContextMenu(e: MouseEvent, file: OpenFile) {
    e.preventDefault();
    e.stopPropagation();

    const root = rootPath();
    const relPath =
      root && file.path.startsWith(root)
        ? file.path.slice(root.length).replace(/^[/\\]/, "")
        : file.name;

    openContextMenu(e.clientX, e.clientY, [
      {
        label: "Close",
        icon: "codicon-close",
        shortcut: "⌘W",
        action: () => closeFile(file.path),
      },
      {
        label: "Close Others",
        action: () => closeOtherFiles(file.path),
      },
      {
        label: "Close Tabs to the Right",
        action: () => closeFilesToRight(file.path),
      },
      {
        label: "Close All",
        action: () => closeAllFiles(),
      },
      { separator: true },
      {
        label: "Copy Path",
        icon: "codicon-copy",
        action: () => navigator.clipboard.writeText(file.path),
      },
      {
        label: "Copy Relative Path",
        icon: "codicon-files",
        action: () => navigator.clipboard.writeText(relPath),
      },
      ...(file.path.startsWith("untitled://")
        ? []
        : [
            {
              label: "Reveal in Finder",
              icon: "codicon-folder-opened",
              action: () => revealItem(file.path),
            },
          ]),
    ]);
  }

  function handleEmptyBarContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    openContextMenu(e.clientX, e.clientY, [
      {
        label: "New File",
        icon: "codicon-new-file",
        shortcut: "⌘N",
        action: () => newUntitledFile(),
      },
      {
        label: "Close All Tabs",
        action: () => closeAllFiles(),
      },
    ]);
  }

  return (
    <Show when={openFiles.length > 0}>
      <div class="tab-bar">
        <div class="tab-list" onContextMenu={handleEmptyBarContextMenu}>
          <For each={openFiles}>
            {(file) => {
              const iconInfo = getFileIcon(file.name);
              return (
                <div
                  class={`tab ${
                    activeFilePath() === file.path ? "active" : ""
                  }`}
                  onClick={() => setActiveFilePath(file.path)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      closeFile(file.path);
                    }
                  }}
                  onContextMenu={(e) => handleTabContextMenu(e, file)}
                  title={file.path}
                >
                  <span class="tab-icon">
                    <i
                      class={`codicon ${iconInfo.icon}`}
                      style={{ color: iconInfo.color }}
                    />
                  </span>
                  <span class="tab-name">{file.name}</span>
                  <Show when={isModified(file.path)}>
                    <span class="tab-modified" />
                  </Show>
                  <button
                    class="tab-close"
                    onClick={(e) => handleClose(e, file.path)}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Close (⌘W)"
                  >
                    <i class="codicon codicon-close" />
                  </button>
                </div>
              );
            }}
          </For>
        </div>

        <div class="tab-actions">
          <Show when={canPreview()}>
            <button
              class={`tab-action-btn ${isPreviewOpen() ? "active" : ""}`}
              onClick={togglePreview}
              title={
                isPreviewOpen()
                  ? "Close Preview (⌘⇧V)"
                  : "Open Live Preview (⌘⇧V)"
              }
            >
              <i class="codicon codicon-preview" />
              <span>{isPreviewOpen() ? "Close Preview" : "Preview"}</span>
            </button>
          </Show>
        </div>
      </div>
    </Show>
  );
}
