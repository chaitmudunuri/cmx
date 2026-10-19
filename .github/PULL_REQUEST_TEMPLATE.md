# Description

<!-- What does this change, and why? Link any related issue: Fixes #123 -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Performance
- [ ] Refactor / internal cleanup
- [ ] Docs, screenshots, or build tooling

## Platform

<!-- Which platforms did you test on? Only macOS/Apple Silicon has a prebuilt
     binary today, so Linux and Windows testing is especially valuable. -->

- [ ] macOS (Apple Silicon)
- [ ] macOS (Intel)
- [ ] Linux
- [ ] Windows

## Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` passes
- [ ] `cargo test` passes (from `src-tauri/`)
- [ ] `cargo clippy -- -D warnings` is clean (from `src-tauri/`)
- [ ] `pnpm bench --runs 3` re-run, and numbers updated, **if** this affects startup, IO, or binary size

## Visual changes

<!-- If this changes the UI, attach before/after screenshots in light and dark
     themes. If it changes a README screenshot, follow docs/screenshots/SHOT-LIST.md
     and keep the existing filenames. -->

- [ ] No visual change
- [ ] Screenshots attached
- [ ] README screenshots updated

## Notes for reviewers

<!-- Anything that makes review faster: areas you're unsure about, trade-offs you
     made, or follow-ups deliberately left out of scope. -->