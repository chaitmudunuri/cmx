# CMX roadmap

CMX is pre-1.0. This document is a working plan, not a promise — no dates,
because the [issue tracker](https://github.com/chaitmudunuri/cmx/issues) is the
source of truth for what actually gets built next.

Want to influence it? [Vote on open issues](https://github.com/chaitmudunuri/cmx/issues)
or [start a discussion](https://github.com/chaitmudunuri/cmx/discussions).

**What CMX is:** a lightweight, high performance code editor with Vim mode, workspace search,
and live preview. No Electron, no bundled browser.

## Where CMX is today

| Platform | Prebuilt download | Status |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` | Available in every release |
| macOS (Intel) | — | Builds from source |
| Linux (x86_64) | — | Builds from source |
| Windows (x86_64) | — | Builds from source |

## v0.2.0 — Packaging for all three platforms

**The next milestone.** The goal is that nobody has to build from source.

- [ ] macOS universal binary — Intel alongside Apple Silicon
- [ ] Linux `.deb`, `.rpm` and AppImage, published from CI
- [ ] Windows NSIS installer, published from CI
- [ ] Code signing and notarization for macOS and Windows
- [ ] SHA-256 checksums for every published artifact

## v0.3.0 — Everyday editor

- [ ] Language Server Protocol — completion, diagnostics, go-to-definition
- [ ] Additional themes and a theme picker
- [ ] Configurable key bindings
- [ ] Workspace-level find-and-replace
- [ ] Split view for two files side by side

## v0.4.0 — Extensibility

- [ ] Plugin API for language tooling
- [ ] Command palette extensions
- [ ] Import and export of CMX settings

## Under consideration

No commitment — things people have asked for that haven't been sequenced yet.

- Global symbol search
- Multi-cursor editing driven by selection matches
- Git integration (status in the file explorer)
- Formatters wired to language servers
- Multiple windows for the same workspace

## Not planned

Said out loud so you don't have to ask:

- **Plugin execution.** CMX renders in the OS webview; plugins that run arbitrary
  native code would undercut the reason it ships no browser runtime. If plugins
  arrive they will be declarative and sandboxed.
- **A built-in terminal multiplexer.** tmux and the terminal already do this.
- **Cloud sync of settings.** Settings are a small file; put it in your dotfiles
  repo.

## Reporting progress

If you are testing a build on Linux or Windows, that's the most useful thing you
can do right now — those platforms have no prebuilt binary and no maintainer
coverage. Please
[open an issue](https://github.com/chaitmudunuri/cmx/issues/new/choose) with your
distribution, desktop environment and anything that broke.