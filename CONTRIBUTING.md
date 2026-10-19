# Contributing to CMX

CMX is a young project and contributions of every size are welcome — a typo fix,
a platform bug report, a whole feature. If you can reproduce a problem or you
have an idea, [open an issue](https://github.com/chaitmudunuri/cmx/issues/new/choose);
you don't need to have a fix in hand. Questions and open-ended discussion belong
in [Discussions](https://github.com/chaitmudunuri/cmx/discussions) instead — that
keeps the issue tracker usable for actual bugs and features.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Project maturity

CMX is pre-1.0. Expect APIs to move, and please say so in issues when something
changes out from under you — that's valuable signal, not a complaint.

The most useful contributions right now:

- **Platform testing.** Only macOS/Apple Silicon has a prebuilt binary. Linux
  and Windows users are the highest-value bug reporters we have.
- **Editor-fidelity fixes.** Vim motions, CodeMirror behaviour, and
  large-file handling are where a careful user will find edge cases.
- **Search correctness.** `live_grep` walks the tree with ripgrep's `ignore`
  crate; regressions here are subtle and important.
- **Docs and screenshots.** README accuracy matters more than polish.

## Naming and terminology

CMX's docs, release notes, UI strings and alt text share one vocabulary. Using
it consistently is part of the job, not polish — it is what makes CMX
searchable and what stops the docs drifting apart.

**The one-liner.** Use this sentence, unchanged, in the README opening, the
project website, and the first line of every release:

> A lightweight code editor engineered for speed. Powered by Rust and the native
> OS webview with Vim mode, workspace search, and live preview.

**The name.** Write **CMX** in prose. `cmx` is the repository and `cmx editor`
is the installed application bundle — use those only when you mean the repo or
the `.app`/installer specifically.

| Say | Not |
|---|---|
| CMX | cmx, cmx editor, CMX Editor |
| code editor | text editor, programmer's editor, IDE |
| workspace search | ripgrep search, grep, live_grep, global search |
| Quick Open | fuzzy finder, file finder |
| command palette | command menu |
| live preview | preview pane, split view, rendered view |
| Vim mode | vim, Vi mode |
| file explorer | Explorer, sidebar, file tree |
| fast mode | large-file mode, performance mode |
| OS webview | embedded browser, webview |
| Go to Line | goto, jump to line |

**Alt text describes the picture, not the keywords.** Write what a reader would
say out loud — "CMX code editor showing the command palette and quick file
search." — not a comma-separated keyword list. Alt text is read aloud by screen
readers and indexed by image search; stuffing it helps neither.

**Release notes** must only list artifacts that are actually attached to the
release — check with `gh release view <tag> --json assets` before publishing. A
download link that 404s costs more trust than a missing feature list.

## Getting set up

Prerequisites:

- [Node 20+](https://nodejs.org) and [pnpm](https://pnpm.io)
- [Rust stable](https://rustup.rs) — macOS: `xcode-select --install`
- Linux only: `libwebkit2gtk-4.1-dev`, `libxdo-dev`, `libayatana-appindicator3-dev`,
  `librsvg2-dev` (full list in the [Tauri docs](https://v2.tauri.app/start/prerequisites/))

```sh
git clone https://github.com/chaitmudunuri/cmx.git
cd cmx
pnpm install
pnpm tauri dev
```

## Making a change

1. **Branch off `main`** — `git checkout -b fix/vim-word-motions`.
2. **Keep the diff focused.** Unrelated cleanups in a feature PR make review
   slower for everyone. Open a separate PR for refactors.
3. **Match the surrounding style.** CMX uses 2-space indentation, double quotes,
   semicolons in TypeScript, and `snake_case` in Rust. Don't reformat files you
   aren't otherwise changing.
4. **Write comments only for *why*.** The code should read as prose; comments
   explain intent that the code can't express.
5. **Never commit secrets, personal paths or `node_modules/`.** The `.gitignore`
   already covers build output.

### Commit messages

Use the imperative mood, capitalized, no trailing period — matching the existing
history:

```
Add regex toggle to workspace search
Fix tab close preserving sibling scroll position
Improve large-file detection threshold
```

A `Fixes #123` or `Closes #123` line in the body is very welcome.

## Checks to run before you open a PR

```sh
npx tsc --noEmit                 # frontend typecheck
pnpm build                       # production frontend build
cd src-tauri && cargo test       # Rust unit tests
cd src-tauri && cargo clippy -- -D warnings
pnpm bench --runs 3              # only if you touched startup, IO or the shell
```

If `pnpm bench` numbers in the README would change (binary size, cold start,
memory), please include the new measurement in the PR description — the
[Performance](README.md#performance) table should stay honest.

## Pull requests

Fill in the PR template. Review is best-effort and may take a few days; a short
"still working on this" nudge is fine. If a PR has been quiet for two weeks
without a comment, assume it's not being reviewed rather than rejected.

For larger changes, open an issue first so we can agree on approach before you
spend the effort.

## Adding screenshots

README screenshots live in `docs/screenshots/`. If your change is visible,
recapture the affected shot following
[`docs/screenshots/SHOT-LIST.md`](docs/screenshots/SHOT-LIST.md) and keep the
existing filenames — the README links them by name. Drop each PNG under ~1 MB.

## Changing the website

The website in `docs/` is **generated**. Do not hand-edit the HTML — edit
`scripts/build_site.py` and re-run it:

```sh
python3 scripts/build_site.py
```

It writes every page, `sitemap.xml`, `robots.txt` and `assets/site.css` from a
single source, so navigation, canonical URLs and structured data cannot drift
apart. Two things worth knowing:

- **`SITE_URL` near the top of the script** is the site origin. Change it in one
  place when moving to a custom domain; canonical tags, the sitemap, `robots.txt`
  and every JSON-LD block follow automatically.
- Keep alt text descriptive (see [Naming and terminology](#naming-and-terminology))
  and only publish performance figures you have actually measured — the
  performance page is meant to be checkable.

CI does not build the site yet. If you change `build_site.py`, run it and commit
the regenerated output.

## Reporting bugs

Good bug reports are the single most valuable thing you can send. Please include:

- CMX version, OS and architecture
- what you expected, and what happened instead
- minimal reproduction steps or a small fixture project
- logs from the app's developer console where relevant

Use the [bug report template](https://github.com/chaitmudunuri/cmx/issues/new/choose).
If you're not sure whether something is a bug, ask in
[Discussions](https://github.com/chaitmudunuri/cmx/discussions) first.

## Security issues

Please **do not** open a public issue for security problems. Follow
[SECURITY.md](SECURITY.md).

## License

CMX is MIT-licensed. By contributing you agree that your contributions are
licensed under the [MIT License](LICENSE).