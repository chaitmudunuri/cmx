# cmx editor

A lightweight, native-feel programmer's editor for macOS, Linux, and Windows —
**Tauri 2** shell, **CodeMirror 6** editing core, **Solid.js** chrome. No
Electron, no bundled Chromium: it renders through the OS webview, starts fast,
and stays out of your way.

![cmx workspace — dark theme](docs/screenshots/01-workspace-dark.png)

## Highlights

- **Fast by construction** — single shared editor view across tabs, lazily
  loaded language packs, cancellable search, parallel session restore.
  Initial JS is ~576KB raw (~190KB gzip); the release binary is ~7MB.
- **Real editor fundamentals** — tabs, explorer tree, ripgrep search with
  context, `⌘P` Quick Open, Markdown/HTML/SVG live preview.
- **Vim when you want it** — off by default; Friendly and Expert levels with
  motions, visual modes, and `:w`-style Ex commands when enabled.
- **Two polished themes** — dark and GitHub-style light, switched instantly
  without losing state, cursor, or scroll.
- **Quiet extras** — session restore (tabs, folder, untitled buffers),
  large-file fast mode, per-language syntax highlighting including fenced
  code blocks, six coding fonts, confirm-before-close, native file dialogs.

![cmx workspace — light theme](docs/screenshots/02-workspace-light.png)

## Screenshots

| | |
|---|---|
| ![Quick Open](docs/screenshots/03-quick-open.png) | ![Search and live preview](docs/screenshots/04-search-preview.png) |
| *Command Palette & `⌘P` Quick Open* | *Side-by-side Markdown preview with draggable resizer* |
| ![Settings](docs/screenshots/05-settings.png) | |
| *`⌘,` — Vim toggle, text size, tab size, and font picker with live previews* | |

## Features

### Editing
- CodeMirror 6 core: multiple cursors, bracket matching/closing, folding,
  search/replace panel, highlight of selection matches and active line.
- Per-language highlighting (JS/TS, Python, Rust, C/C++, Java, Go via C++,
  HTML, CSS, JSON, Markdown, SQL, XML, YAML, Shell, Dockerfile) loaded **on
  demand** — opening a file never waits on languages you don't use.
- Markdown gets full treatment: headings, emphasis, code, quotes, lists,
  links, plus highlighted fenced code blocks.
- Large files (>1.5MB or 25k lines) automatically drop into fast mode
  (parsing and extras off, editing stays smooth) with a `⚡ FAST` badge.
- Tab size 2/4/8, word wrap (`⌥Z`), zoom (`⌘=`/`⌘-`/`⌘0`), six monospace
  fonts headlined by JetBrains Mono with ligatures.

### Vim mode
- Three levels, toggled from the status-bar pill or command palette:
  **Off** (default — plain editor), **Friendly** (hints + forgiving Ex set),
  **Expert** (full motions).
- Ex commands: `:w` `:q[!]` `:wq` `:x` `:e` `:noh` `:bd` `:new`, plus a
  which-key style hint bar and a mode pill (`NORMAL` / `INSERT` / `VISUAL`).

### Navigation
- **Explorer tree** — create/rename/delete files and folders inline, reveal
  in Finder/Explorer, open/close folder; the tree patches itself in place
  (no collapse-everything reloads on save).
- **Quick Open (`⌘P`)** — ranked file finder (filename hits first),
  command palette (`⌘⇧P` / `F1`), and `:line[,col]` goto.
- **Search (`⌘⇧F`)** — workspace ripgrep with 2-line context, grouped by
  file, match highlighting, 150ms debounce; in-flight searches cancel when
  you keep typing.
- **Tabs** — dirty dots, per-tab scroll/memory, close one/right/others/all,
  unsaved-change confirmation.

### Live preview (`⌘⇧V`)
Side-by-side rendering for **Markdown** (debounced, GitHub-flavored),
**HTML** (sandboxed iframe), and **SVG** — with a drag splitter and
double-click reset.

### Status bar
Vim pill, language, `Ln, Col` (click → Go to Line) with **total line
count**, selection size, word-wrap toggle, encoding — plus loading and
fast-mode indicators.

## Shortcuts

| Shortcut | Action |
|---|---|
| `⌘P` / `Ctrl+P` | Quick Open (ranked file finder) |
| `⌘⇧P` / `F1` | Command palette |
| `⌘⇧F` / `Ctrl+Shift+F` | Ripgrep workspace search |
| `⌘⇧V` / `Ctrl+Shift+V` | Toggle live preview (Markdown/HTML/SVG) |
| `⌘S` / `Ctrl+S` | Save (no tree reload; save-as for untitled) |
| `⌘O` / `Ctrl+O` | Open file · `⌘B` sidebar · `⌘N` new file |
| `⌘G` / `Ctrl+G` | Go to line/column |
| `⌘,` / `Ctrl+,` | Settings (Vim, text size, tab size, fonts) |
| `⌘=` `⌘-` `⌘0` | Zoom in / out / reset |
| `⌥Z` / `Alt+Z` | Toggle word wrap |
| `⌘⇧E` | Explorer view · `Esc` dismisses dialogs only |

## Getting started

Prerequisites: Node 20+ with `pnpm`, Rust stable (macOS: `xcode-select
--install`; Linux: `libwebkit2gtk-4.1-dev` + friends per the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

```sh
pnpm install        # install frontend deps
pnpm tauri dev      # Vite + Tauri with hot reload (http://127.0.0.1:1420)
pnpm build          # frontend bundle only (tsc-clean, ~2s)
pnpm tauri build    # release .app + .dmg in src-tauri/target/release/bundle/
```

Useful checks: `npx tsc --noEmit`, and backend tests with `cargo test`
run from `src-tauri/` (search ranking, grep context windows, preview
bounds are all covered).

### Benchmarking

`pnpm bench` launches the release binary and profiles its resource
footprint over a series of runs — cold-start time, CPU (% per logical
core), and RSS memory — reporting median/mean/min/max plus a
machine-readable `__CMX_BENCH__` JSON line for CI.

```sh
pnpm bench                      # default: binary auto-discovered, 1 run
pnpm bench --runs 5             # statistics over 5 launches
pnpm bench --window 10000       # longer sampling window (default 5000 ms)
pnpm bench --bin /path/to/cmx   # explicit binary
```

## Project layout

```
cmx/
  index.html            # pre-paint theme/font init (no first-frame flash)
  src/
    App.tsx             # shortcuts, theme effect, modals, layout shell
    index.tsx           # Solid mount
    stores/editor.ts    # signals/store: files, tree, search, settings, session
    components/
      Editor.tsx        # CodeMirror lifecycle (single shared view)
      Sidebar.tsx       # explorer tree (SidebarSearch.tsx = ripgrep view)
      QuickOpen.tsx     # files / commands / goto palette
      LivePreview.tsx   # Markdown / HTML / SVG pane (marked loads lazily)
      TabBar.tsx StatusBar.tsx TitleBar.tsx ContextMenu.tsx
      FontSettingsModal.tsx GoToLineModal.tsx ConfirmCloseModal.tsx
  src-tauri/
    src/main.rs         # Tauri setup, native menu accelerators
    src/commands.rs     # file IO, dir listing, find_files, live_grep, preview
    tauri.conf.json capabilities/  # windows, bundle, permission grants
  docs/screenshots/     # README images + SHOT-LIST.md capture guide
  scripts/
    capture_screenshots.mjs  # headless-Brave CDP screenshot capture
    bench.mjs                # release-binary CPU/RAM/startup profiler
```

## Performance

Measured with `pnpm bench` (release build, Apple Silicon / arm64, 8 GB
RAM — 5 runs, median):

| Metric | Value |
|---|---|
| Cold start to ready | ~2.4 s |
| CPU — average | ~0.1% of one core |
| CPU — peak | ~1.3% of one core |
| Memory (RSS) — average | ~95 MB |
| Memory (RSS) — peak | ~95 MB |
| Peak memory vs physical RAM | ~1.2% |

Release artifacts: **6.7 MB binary · 6.9 MB `.app` · 3.6 MB `.dmg`** —
no bundled Chromium.

Reproduce with:

```sh
pnpm bench --runs 5
```

---

*Built with Tauri 2 + CodeMirror 6 + Solid.js. Screenshots: `docs/screenshots/SHOT-LIST.md`.*
