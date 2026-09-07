import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { convertFileSrc } from "@tauri-apps/api/core";
import { editorStore } from "../stores/editor";

type MarkedParse = (src: string) => string;

function resolveRelativePath(baseDir: string, relativePath: string): string {
  const isWindows = baseDir.includes("\\");
  const sep = isWindows ? "\\" : "/";
  const baseParts = baseDir.split(/[\\/]/).filter(Boolean);
  const relParts = relativePath.split(/[\\/]/).filter(Boolean);

  for (const part of relParts) {
    if (part === ".") continue;
    if (part === "..") {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }

  const prefix = isWindows ? "" : "/";
  return prefix + baseParts.join(sep);
}

function rewriteMarkdownImages(html: string, docPath: string): string {
  if (!docPath || docPath.startsWith("untitled://")) return html;
  const dir = docPath.replace(/[\\/][^\\/]+$/, "");

  return html.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, src, after) => {
      if (
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("data:") ||
        src.startsWith("blob:") ||
        src.startsWith("asset:")
      ) {
        return match;
      }
      const absPath =
        src.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(src)
          ? src
          : resolveRelativePath(dir, src);
      try {
        const assetUrl = convertFileSrc(absPath);
        return `<img ${before}src="${assetUrl}"${after}>`;
      } catch {
        return match;
      }
    }
  );
}

export default function LivePreview() {
  const { activeFile, previewType, isPreviewOpen, togglePreview } = editorStore;
  const [previewWidth, setPreviewWidth] = createSignal<number | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);
  // marked ships as its own async chunk and loads on first markdown preview.
  const [markedParse, setMarkedParse] = createSignal<MarkedParse | null>(null);

  function handleResizerMouseDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    document.body.classList.add("is-resizing");

    const startX = e.clientX;
    const paneEl = (e.currentTarget as HTMLElement).parentElement;
    const startWidth = paneEl ? paneEl.getBoundingClientRect().width : (previewWidth() ?? 500);

    function onMouseMove(moveEvent: MouseEvent) {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(260, Math.min(window.innerWidth - 300, startWidth + delta));
      setPreviewWidth(newWidth);
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

  const renderedMarkdown = createMemo(() => {
    if (!isPreviewOpen()) return "";
    const file = activeFile();
    if (!file || previewType() !== "markdown") return "";
    if (file.isLarge || file.content.length > 1_500_000) {
      return `<div style="padding: 24px; color: var(--text-muted); font-size: 13px; line-height: 1.6;">
        <p><strong>Markdown Live Preview is disabled for large documents (&gt;1.5MB)</strong> to maintain fast editor performance.</p>
      </div>`;
    }
    const parse = markedParse();
    if (!parse) {
      // Kick off the async chunk exactly once, on first actual need.
      import("marked")
        .then((m) =>
          setMarkedParse(
            () => (src: string) => m.marked.parse(src, { async: false }) as string
          )
        )
        .catch((e) => console.error("Failed to load markdown renderer:", e));
      return `<div style="padding: 24px; color: var(--text-muted); font-size: 13px;">Loading preview…</div>`;
    }
    try {
      const html = parse(file.content);
      return rewriteMarkdownImages(html, file.path);
    } catch (e) {
      return `<p style="color: var(--danger)">Markdown parsing error: ${String(e)}</p>`;
    }
  });

  return (
    <Show when={isPreviewOpen() && previewType()}>
      <div
        class="live-preview-pane"
        style={
          previewWidth()
            ? {
                width: `${previewWidth()}px`,
                "flex-basis": `${previewWidth()}px`,
                "flex-grow": 0,
                "flex-shrink": 0,
              }
            : undefined
        }
      >
        {/* Resize Handle Splitter */}
        <div
          class={`preview-resizer ${isDragging() ? "is-resizing" : ""}`}
          onMouseDown={handleResizerMouseDown}
          onDblClick={() => setPreviewWidth(null)}
          title="Drag to resize preview (double-click to reset)"
        />
        <div class="preview-pane-header">
          <div class="preview-pane-title">
            <Show
              when={previewType() === "markdown"}
              fallback={<i class="codicon codicon-browser" style="color: #e44d26;" />}
            >
              <i class="codicon codicon-markdown" style="color: #42a5f5;" />
            </Show>
            <span>
              {previewType() === "markdown"
                ? "Markdown Preview"
                : previewType() === "html"
                ? "HTML Live Preview"
                : "SVG Preview"}
            </span>
          </div>
          <button
            class="preview-pane-close"
            onClick={togglePreview}
            title="Close Preview (⌘⇧V)"
          >
            <i class="codicon codicon-close" />
          </button>
        </div>

        <div class="preview-pane-content">
          <Show when={previewType() === "markdown"}>
            <div
              class="markdown-body"
              innerHTML={renderedMarkdown()}
            />
          </Show>

          <Show when={previewType() === "html"}>
            <iframe
              class="html-preview-frame"
              srcdoc={activeFile()?.content ?? ""}
              sandbox="allow-scripts allow-same-origin"
              title="HTML Preview"
            />
          </Show>

          <Show when={previewType() === "svg"}>
            <div
              class="svg-preview-container"
              innerHTML={activeFile()?.content ?? ""}
            />
          </Show>
        </div>
      </div>
    </Show>
  );
}
