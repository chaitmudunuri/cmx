# Screenshot capture guide

The README references the five PNGs in this folder. **Do not rename them** — the
README links each by exact filename, and CI (`.github/workflows/ci.yml`) fails
if a referenced file goes missing.

| File | README section |
|---|---|
| `01-workspace-dark.png` | Hero (top of page) |
| `02-workspace-light.png` | Hero, below the intro |
| `03-quick-open.png` | Screenshots → Quick Open |
| `04-search-preview.png` | Screenshots → Workspace search and live preview |
| `05-settings.png` | Screenshots → Settings |

`01-workspace-dark.png` is also the source image for the GitHub social preview
(`docs/social-preview.png`). Re-run `python3 scripts/make_social_preview.py`
after replacing it.

### Alt text

Every screenshot carries alt text that describes **what the picture shows**, in
plain words — not a keyword list. When you add or re-capture a shot, update the
matching `alt` in `README.md` and `docs/index.html` in the same commit:

```
alt="CMX code editor showing the command palette and quick file search."
```

See [Naming and terminology](../../CONTRIBUTING.md#naming-and-terminology) for the
full vocabulary.

## Setup

1. Run the app: `pnpm tauri dev` (or open the release `.app`).
2. Use this fixture workspace (or any small project):
   - a `src/` folder with a few `.rs`/`.ts` files
   - one `notes.md` with headings, bold, code, a list, and a link
   - one `page.html`
3. Set the window to **1380 × 723** to match the existing images.
4. macOS capture: `⇧⌘4`, then `Space` + click the CMX window (clean window shot
   with shadow). Or use the headless path below.

### Headless capture (macOS)

`scripts/capture_screenshots.mjs` serves the built frontend with `vite preview`
and drives a headless Brave instance over CDP, writing the PNGs straight into
this folder:

```sh
pnpm build                        # the script serves dist/ via vite preview
node scripts/capture_screenshots.mjs
```

Note the current script hardcodes Brave at
`/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`. Edit that path
to match your install, or capture manually with `⇧⌘4` as above.

Because it renders the web frontend rather than the Tauri shell, native chrome
(menu bar, native dialogs) may differ from a real launch. Review the output
before committing.

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

### `04-search-preview.png` — search and live preview
- Show both halves of the feature in one frame if possible:
  - **Search**: `⌘⇧F`, type a common token (e.g. `fn`), grouped results with
    match counts expanded.
  - **Preview**: open `notes.md`, press `⌘⇧V` so code and rendered Markdown
    sit side-by-side.
- If you can't get both, capture the preview as `04-search-preview.png` and put
  search on its own — then update the README heading to match.

### `05-settings.png` — settings modal
- Press `⌘,` anywhere. Goal: Vim toggle + Text Size slider + Tab Size
  segmented control + font cards with live code preview.

## After capturing

```sh
ls docs/screenshots/
# 01-workspace-dark.png  02-workspace-light.png  03-quick-open.png
# 04-search-preview.png  05-settings.png
```

Checklist:

- Keep each PNG under ~1 MB. `sips -Z 1440 <file>` (macOS) or
  `pngquant` will shrink them; 1380 × 723 is plenty for the README.
- **Remove any personal paths, usernames or filenames** visible in the UI.
- Confirm the README still renders: every image is wrapped in an `<a>` tag with
  `width="820"`, so a new file only needs the same pattern.
- Update alt text alongside the image — see [Alt text](#alt-text) above.
- `SHOT-LIST.md` is the only non-image file in this folder — that's expected.