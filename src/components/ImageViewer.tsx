import { createSignal, createEffect, Show } from "solid-js";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { OpenFile } from "../stores/editor";

export default function ImageViewer(props: { file: OpenFile }) {
  const [zoom, setZoom] = createSignal<number>(1);
  const [fitMode, setFitMode] = createSignal<boolean>(true);
  const [naturalWidth, setNaturalWidth] = createSignal<number>(0);
  const [naturalHeight, setNaturalHeight] = createSignal<number>(0);
  const [imgError, setImgError] = createSignal<string | null>(null);
  const [srcUrl, setSrcUrl] = createSignal<string>("");

  createEffect(() => {
    const path = props.file.path;
    if (!path) {
      setSrcUrl("");
      return;
    }
    setImgError(null);
    if (
      path.startsWith("data:") ||
      path.startsWith("blob:") ||
      path.startsWith("http://") ||
      path.startsWith("https://")
    ) {
      setSrcUrl(path);
      return;
    }
    try {
      const asset = convertFileSrc(path);
      setSrcUrl(asset);
    } catch {
      // If convertFileSrc is not available, immediately invoke backend
      invoke<string>("read_image_data", { path })
        .then((dataUrl) => setSrcUrl(dataUrl))
        .catch((err) => setImgError(`Failed to load: ${err}`));
    }
  });

  const ext = () => props.file.name.split(".").pop()?.toUpperCase() ?? "IMG";

  function onImageLoad(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    setNaturalWidth(img.naturalWidth);
    setNaturalHeight(img.naturalHeight);
    setImgError(null);
  }

  async function onImageError() {
    const path = props.file.path;
    if (path && !srcUrl().startsWith("data:")) {
      try {
        const dataUrl = await invoke<string>("read_image_data", { path });
        if (dataUrl) {
          setSrcUrl(dataUrl);
          setImgError(null);
          return;
        }
      } catch (err) {
        console.warn("Image fallback error:", err);
      }
    }
    setImgError("Failed to load image preview");
  }

  function zoomIn() {
    setFitMode(false);
    setZoom((z) => Math.min(5, Math.round((z + 0.25) * 100) / 100));
  }

  function zoomOut() {
    setFitMode(false);
    setZoom((z) => Math.max(0.1, Math.round((z - 0.25) * 100) / 100));
  }

  function resetZoom() {
    setFitMode(false);
    setZoom(1);
  }

  function toggleFit() {
    setFitMode((prev) => !prev);
    if (!fitMode()) setZoom(1);
  }

  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setFitMode(false);
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoom((z) => Math.min(5, Math.max(0.1, Math.round((z + delta) * 100) / 100)));
    }
  }

  return (
    <div class="image-viewer-container" onWheel={handleWheel}>
      {/* Top Toolbar */}
      <div class="image-viewer-toolbar">
        <div class="image-viewer-info">
          <span class="image-format-badge">{ext()}</span>
          <Show when={naturalWidth() > 0}>
            <span class="image-dims">
              {naturalWidth()} × {naturalHeight()} px
            </span>
          </Show>
        </div>

        <div class="image-viewer-actions">
          <button
            class={`image-viewer-btn ${fitMode() ? "active" : ""}`}
            onClick={toggleFit}
            title="Toggle Fit to Window"
          >
            <i class="codicon codicon-screen-full" />
            <span>Fit</span>
          </button>
          <button class="image-viewer-btn" onClick={zoomOut} title="Zoom Out (⌘-)">
            <i class="codicon codicon-zoom-out" />
          </button>
          <button
            class="image-viewer-btn image-zoom-val"
            onClick={resetZoom}
            title="Reset Zoom to 100%"
          >
            {fitMode() ? "Auto" : `${Math.round(zoom() * 100)}%`}
          </button>
          <button class="image-viewer-btn" onClick={zoomIn} title="Zoom In (⌘+)">
            <i class="codicon codicon-zoom-in" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div class="image-viewer-canvas" onDblClick={toggleFit}>
        <Show
          when={!imgError()}
          fallback={
            <div class="image-load-error">
              <i class="codicon codicon-error" />
              <span>{imgError()}</span>
            </div>
          }
        >
          <Show when={srcUrl()}>
            <img
              src={srcUrl()}
              alt={props.file.name}
              onLoad={onImageLoad}
              onError={onImageError}
              class={`image-viewer-img ${fitMode() ? "fit-mode" : ""}`}
              style={fitMode() ? undefined : { transform: `scale(${zoom()})` }}
            />
          </Show>
        </Show>
      </div>
    </div>
  );
}
