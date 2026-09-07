# Screenshot capture guide

The README references images in this folder. They must be captured from a
running `cmx editor` build because this sandbox has no display access
(`screencapture` fails, UI automation is denied). Takes ~5 minutes.

## Setup

1. Run the app: `pnpm tauri dev` (or open the release `.app`).
2. Use this fixture workspace (or any small project):
   - a `src/` folder with a few `.rs`/`.ts` files
   - one `notes.md` with headings, bold, code, a list, and a link
   - one `page.html`
3. Set window size to ~1440×900 for consistent framing.
4. macOS screenshot keys: `⇧⌘4`, then `Space` + click the cmx window
   (clean window shot with shadow). Save files with the exact names below.

## Shots

### `01-workspace-dark.png` — main workspace, dark theme
- Theme: dark. Open the fixture folder, then open a code file.
- Sidebar: Explorer visible with the tree expanded.
- Goal: editor with syntax highlighting + tabs + status bar visible.
- Suggested file: a Rust or TypeScript file with varied syntax.

### `02-workspace-light.png` — same workspace, light theme
- `⌘⇧P` → **Switch to Light+ Theme** (or the titlebar theme button).
- Same file/layout as shot 01 for direct comparison.

### `03-quick-open.png` — Quick Open over the workspace
- Dark theme. Press `⌘P`, type 2–3 letters so ranked results show.
- Goal: floating palette with file icons + `⌘P` hint visible.

### `04-search-preview.png` — ripgrep search and/or live preview
- Either (or both, one image each suffixed `-search` / `-preview`):
  - **Search**: `⌘⇧F`, type a common token (e.g. `function`), grouped
    results with match counts expanded.
  - **Preview**: open `notes.md`, press `⌘⇧V` so code + rendered
    Markdown sit side-by-side.

### `05-settings.png` — settings modal
- Press `⌘,` anywhere. Goal: Vim toggle + Text Size slider + Tab Size
  segmented control + font cards with live code preview.

## After capturing

```sh
ls docs/screenshots/
# 01-workspace-dark.png  02-workspace-light.png  03-quick-open.png
# 04-search-preview.png  05-settings.png
```

Keep each PNG under ~1MB (`sips -Z 1440 <file>` helps). The README in
the repo root already links these exact filenames — no edits needed once
the files land here. Delete this guide if you prefer (`SHOT-LIST.md`
is the only non-image file in this folder).
