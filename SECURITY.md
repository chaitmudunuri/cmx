# Security Policy

## Supported versions

CMX is pre-1.0. Only the latest release receives fixes; there is no LTS branch.

| Version | Supported |
|---|---|
| `0.1.x` (latest release) | ✅ |
| `< 0.1.0` | ❌ |

Please update to the latest release before reporting an issue — several classes
of problem only affect older builds.

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Use GitHub's private reporting for this repository:
**Security → Report a vulnerability** at
<https://github.com/chaitmudunuri/cmx/security/advisories/new>

Please include:

- affected version and platform
- a description of the impact, and how a user could be exploited
- steps to reproduce, or a proof of concept
- any suggested remediation

You can expect an acknowledgement within 72 hours. Because CMX is maintained by
a single person in their own time, please allow up to 14 days for a fix and
release. We will keep you updated while we work on it, and we will credit you in
the advisory unless you prefer to stay anonymous.

If GitHub's private reporting is unavailable in your region, open a regular
issue containing only a one-line note asking for a private contact channel, with
no technical detail.

## Threat model

CMX is a **local** desktop editor. It has no network service, no account system
and no telemetry. Its security posture is about what it does with the files on
your disk and the content you open:

- **File system access.** The editor reads and writes files under the folder you
  open, and files you explicitly choose via the native file dialog. Reports of
  a path-handling bug that lets a save or delete escape the intended folder are
  treated as high severity.
- **Preview sandboxing.** HTML files are rendered in a sandboxed `<iframe>` and
  SVG in the app's webview. Reports that HTML preview executes script with access
  to the filesystem, or that a crafted Markdown/SVG file can read local files,
  are treated as high severity.
- **Parser availability.** Opening a hostile or very large file should not
  consume unbounded memory or hang the UI. Denial-of-service through file
  content is in scope.
- **OS webview content.** CMX renders in the OS webview (WebKit, WebKitGTK or
  WebView2) rather than shipping Chromium — which means the webview's own
  security is your operating system's responsibility, not ours.

## Out of scope

- Vulnerabilities in Tauri, CodeMirror, Solid.js, `regex`, or the system webview.
  Report these upstream; we'll help coordinate an upgrade if one is needed.
- Lack of code signing or notarization on release binaries.
- Reports from purely automated scanners with no demonstrated impact.
- Social engineering, spam, or denial-of-service against GitHub itself.
- Physical access to an already-running, unlocked machine.

## Disclosure

We follow coordinated disclosure. We'll agree a publication date with the
reporter and credit them unless asked otherwise.