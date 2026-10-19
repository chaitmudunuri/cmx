#!/usr/bin/env python3
"""Generate the CMX static website into docs/.

The GitHub repository is the source of truth for code; this site is the
discovery and adoption layer. Every page is generated from this one file so
that navigation, canonical URLs, structured data and the sitemap can never
drift apart.

Usage:
    python3 scripts/build_site.py

To move the site to a custom domain, change SITE_URL below and add a CNAME file
next to index.html, then re-run. Canonical URLs, the sitemap and every
JSON-LD block follow automatically.
"""

from __future__ import annotations

import datetime
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"

# ---------------------------------------------------------------------------
# Site configuration — change SITE_URL to move to a custom domain
# ---------------------------------------------------------------------------

SITE_URL = "https://chaitmudunuri.github.io/cmx"
REPO_URL = "https://github.com/chaitmudunuri/cmx"
RELEASES_URL = f"{REPO_URL}/releases"
LATEST_URL = f"{RELEASES_URL}/latest"

NAME = "CMX"
VERSION = "0.1.0"
AUTHOR = "chaitmudunuri"
LICENSE = "MIT"
LICENSE_URL = f"{REPO_URL}/blob/main/LICENSE"
DOWNLOAD_URL = f"{RELEASES_URL}/download/v0.1.0/cmx.editor_0.1.0_aarch64.dmg"

# macOS-only .dmg, 3,797,048 bytes — the only artifact published for v0.1.0.
DMG_SIZE_BYTES = 3_797_048

OG_IMAGE = f"{SITE_URL}/social-preview.png"

TAGLINE = ("A native-feeling code editor with Vim mode, workspace search, "
           "and live preview. No Electron, no bundled browser.")

PLATFORMS = "macOS, Linux, Windows"

NAV = [
    ("Features", "/features.html"),
    ("Performance", "/performance.html"),
    ("Download", "/downloads.html"),
    ("Docs", "/docs.html"),
    ("Contributing", "/contributing.html"),
]

DOCS_NAV = [
    ("Installation", "/docs/installation.html"),
    ("Keyboard shortcuts", "/docs/shortcuts.html"),
    ("Configuration", "/docs/configuration.html"),
    ("Troubleshooting", "/docs/troubleshooting.html"),
    ("Developer setup", "/docs/development.html"),
]

BUILD_DATE = datetime.date.today().isoformat()


# ---------------------------------------------------------------------------
# Structured data
# ---------------------------------------------------------------------------

def software_schema() -> dict:
    """SoftwareApplication, describing only what is verifiably true.

    No aggregateRating or review counts are emitted: CMX has no public rating
    data, and inventing one would be a schema violation.
    """
    return {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": NAME,
        "alternateName": "CMX editor",
        "description": TAGLINE,
        "url": f"{SITE_URL}/",
        "applicationCategory": "DeveloperApplication",
        "applicationSubCategory": "Text editor",
        "operatingSystem": PLATFORMS,
        "softwareVersion": VERSION,
        "license": LICENSE_URL,
        "downloadUrl": DOWNLOAD_URL,
        "installUrl": f"{SITE_URL}/docs/installation.html",
        "softwareHelp": f"{SITE_URL}/docs.html",
        "releaseNotes": f"{RELEASES_URL}/tag/v{VERSION}",
        "image": OG_IMAGE,
        "author": {
            "@type": "Person",
            "name": AUTHOR,
            "url": f"https://github.com/{AUTHOR}",
        },
        "maintainer": {"@type": "Person", "name": AUTHOR},
        "offers": [{
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD",
        }],
        "featureList": [
            "Vim mode with Friendly and Expert levels",
            "Workspace-wide search that respects .gitignore",
            "Quick Open ranked file finder",
            "Live preview for Markdown, HTML and SVG",
            "Large-file fast mode",
            "Dark and light themes",
        ],
        "codeRepository": REPO_URL,
        "programmingLanguage": ["Rust", "TypeScript"],
    }


def source_schema() -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        "name": NAME,
        "description": "Source code for CMX, a code editor built with Tauri 2, CodeMirror 6 and Solid.js.",
        "codeRepository": REPO_URL,
        "programmingLanguage": ["Rust", "TypeScript"],
        "license": LICENSE_URL,
        "runtimePlatform": PLATFORMS,
        "author": {"@type": "Person", "name": AUTHOR, "url": f"https://github.com/{AUTHOR}"},
    }


def breadcrumb_schema(trail: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i,
                "name": name,
                "item": f"{SITE_URL}{href}",
            }
            for i, (name, href) in enumerate(trail, start=1)
        ],
    }


# ---------------------------------------------------------------------------
# Chrome
# ---------------------------------------------------------------------------

def nav_html(current: str) -> str:
    items = []
    for label, href in NAV:
        cls = ' class="on"' if href == current else ""
        if href == "/docs.html":
            subs = "".join(
                f'<a href="{h}">{html.escape(n)}</a>' for n, h in DOCS_NAV
            )
            items.append(
                f'<div class="has-sub"{cls}><a href="{href}">{label}</a>'
                f'<div class="sub">{subs}</div></div>'
            )
        else:
            items.append(f'<a href="{href}"{cls}>{label}</a>')
    items.append(
        f'<a class="gh" href="{REPO_URL}" rel="noopener">GitHub</a>'
    )
    return "".join(items)


def head(title: str, description: str, canonical: str, og_type: str,
         extra_schema: list[dict] | None = None) -> str:
    schemas = extra_schema or []
    ld = ""
    if schemas:
        blocks = []
        for i, s in enumerate(schemas):
            tag = f'schema_{i}'
            blocks.append(
                f'<script type="application/ld+json" id="{tag}">'
                f"{json_min(s)}</script>"
            )
        ld = "\n" + "\n".join(blocks)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(description, quote=True)}">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#141416">
<meta name="color-scheme" content="dark">

<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="{NAME}">
<meta property="og:url" content="{canonical}">
<meta property="og:title" content="{html.escape(title, quote=True)}">
<meta property="og:description" content="{html.escape(description, quote=True)}">
<meta property="og:image" content="{OG_IMAGE}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:image:alt" content="{NAME} code editor showing a dark-theme workspace with the file explorer open and syntax-highlighted TypeScript.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title, quote=True)}">
<meta name="twitter:description" content="{html.escape(description, quote=True)}">
<meta name="twitter:image" content="{OG_IMAGE}">

<link rel="stylesheet" href="/assets/site.css">
<link rel="icon" href="https://raw.githubusercontent.com/{AUTHOR}/cmx/main/app-icon.svg" type="image/svg+xml">
{ld}
</head>"""


def json_min(obj) -> str:
    import json
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def breadcrumbs_html(trail: list[tuple[str, str]]) -> str:
    parts = []
    for name, href in trail:
        parts.append(f'<li><a href="{href}">{html.escape(name)}</a></li>')
    return f'<ol class="crumbs">{"".join(parts)}</ol>'


def page(*, path: str, title: str, description: str, h1: str, body: str,
         og_type: str = "website", trail: list[tuple[str, str]] | None = None,
         extra_schema: list[dict] | None = None) -> tuple[str, str]:
    canonical = f"{SITE_URL}{path if path.endswith('.html') else path + '/'}"
    schemas = list(extra_schema or [])
    if trail:
        schemas.append(breadcrumb_schema(trail))
    schemas.append(software_schema())

    crumb_html = breadcrumbs_html(trail) if trail else ""

    doc = f"""{head(title, description, canonical, og_type, schemas)}
<body>
<header class="site">
  <div class="wrap bar">
    <a class="brand" href="/">CMX</a>
    <nav aria-label="Main">{nav_html(path)}</nav>
  </div>
</header>
<main id="main">
  <div class="wrap">
{crumb_html}
{f'<h1>{h1}</h1>' if h1 else ''}
{body}
  </div>
</main>
<footer class="site">
  <div class="wrap foot">
    <p>CMX is MIT licensed and free software. Built with
      <a href="https://tauri.app">Tauri 2</a>,
      <a href="https://codemirror.net">CodeMirror 6</a> and
      <a href="https://www.solidjs.com">Solid.js</a>, in Rust.
      The <a href="{REPO_URL}">GitHub repository</a> is the source of truth for the code.</p>
    <nav aria-label="Footer">
      <a href="/features.html">Features</a>
      <a href="/performance.html">Performance</a>
      <a href="/downloads.html">Download</a>
      <a href="/docs.html">Docs</a>
      <a href="/contributing.html">Contributing</a>
      <a href="{REPO_URL}">GitHub</a>
    </nav>
  </div>
</footer>
</body>
</html>
"""
    slug = path.lstrip("/") or "index.html"
    return f"{slug}.html" if not slug.endswith(".html") else slug, doc


def link(slug: str) -> str:
    """Root-relative URL for a page slug produced by page()."""
    return "/" + slug


# ---------------------------------------------------------------------------
# Stylesheet
# ---------------------------------------------------------------------------

CSS = """
:root{
  --bg:#141416; --panel:#1f1f23; --panel-2:#242428; --border:#2f2f33;
  --text:#e4e4e7; --muted:#a1a1aa; --faint:#71717a;
  --accent:#0969da; --accent-alt:#21cee8; --ok:#3fb950;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--text);
  font:16px/1.68 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:1000px;margin:0 auto;padding:0 24px}
a{color:var(--accent-alt);text-decoration:none}
a:hover{text-decoration:underline}
:focus-visible{outline:2px solid var(--accent-alt);outline-offset:3px;border-radius:4px}
h1,h2,h3{line-height:1.2;letter-spacing:-.02em;margin-top:0}
h1{font-size:clamp(30px,5vw,42px);margin-bottom:12px}
h2{font-size:26px;margin:48px 0 10px;padding-top:8px}
h3{font-size:18px;margin:28px 0 8px}
p{margin:0 0 16px}
.lede{color:var(--muted);font-size:18px;max-width:70ch}
code{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;font-size:.88em;
  background:var(--panel-2);border:1px solid var(--border);border-radius:5px;padding:.12em .38em}
pre{background:var(--panel);border:1px solid var(--border);border-radius:10px;
  padding:16px 18px;overflow:auto}
pre code{background:none;border:0;padding:0;font-size:13px;line-height:1.6}
table{width:100%;border-collapse:collapse;margin:8px 0 24px;font-size:15px}
th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--border);vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
tbody tr:last-child td{border-bottom:0}
td.y{color:var(--ok);white-space:nowrap}
td.n{color:var(--faint);white-space:nowrap}

/* header */
.site{background:rgba(20,20,22,.9);border-bottom:1px solid var(--border);
  position:sticky;top:0;z-index:20;backdrop-filter:blur(12px)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:20px;height:62px}
.brand{font-size:21px;font-weight:800;letter-spacing:-.03em;color:var(--text)}
.brand:hover{text-decoration:none}
.site nav{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.site nav a{padding:7px 11px;border-radius:7px;color:var(--muted);font-size:15px;font-weight:500}
.site nav a:hover{background:var(--panel);color:var(--text);text-decoration:none}
.site nav a.on{color:var(--text);background:var(--panel)}
.site nav a.gh{background:var(--accent);color:#fff}
.site nav a.gh:hover{background:#0a7ae8;color:#fff}
.has-sub{position:relative}
.has-sub .sub{display:none;position:absolute;top:100%;left:0;min-width:230px;
  background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:6px;
  box-shadow:0 12px 32px rgba(0,0,0,.5)}
.has-sub:hover .sub,.has-sub:focus-within .sub{display:block}
.has-sub .sub a{display:block;padding:8px 11px}

/* hero */
.hero{position:relative;overflow:hidden;padding:76px 0 46px}
.hero::before{content:"";position:absolute;inset:-45% -20% auto -20%;height:560px;
  background:radial-gradient(ellipse at 60% 45%,rgba(9,105,218,.30),transparent 62%);
  filter:blur(30px);pointer-events:none}
.hero .wrap{position:relative}
.logo{font-size:clamp(52px,10vw,82px);font-weight:800;letter-spacing:-.045em;margin:0}
.rule{display:flex;gap:8px;margin:16px 0 24px}
.rule i{display:block;height:7px;border-radius:4px}
.rule i:nth-child(1){width:64px;background:var(--accent)}
.rule i:nth-child(2){width:40px;background:var(--accent-alt)}
.tagline{font-size:clamp(19px,2.6vw,23px);font-weight:600;margin:0 0 10px;max-width:30ch}
.sub{color:var(--muted);margin:0 0 8px}
.platforms{color:var(--faint);font-size:15px;margin:0}

.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:9px;
  font-weight:600;font-size:15px;border:1px solid transparent;transition:.15s}
.btn:hover{text-decoration:none;transform:translateY(-1px)}
.btn-p{background:var(--accent);color:#fff}
.btn-p:hover{background:#0a7ae8}
.btn-s{background:var(--panel);color:var(--text);border-color:var(--border)}
.btn-s:hover{background:var(--panel-2)}

main{padding:34px 0 24px;min-height:60vh}
.shot{width:100%;border:1px solid var(--border);border-radius:12px;display:block}
figure{margin:0 0 8px}
figcaption{color:var(--muted);font-size:15px}
figcaption b{color:var(--text)}
.crumbs{list-style:none;display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:0 0 22px;
  font-size:14px;color:var(--faint)}
.crumbs li+li::before{content:"/";margin-right:8px;color:var(--border)}
.crumbs a{color:var(--faint)}
.crumbs a:hover{color:var(--text)}

/* cards */
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin:8px 0 8px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:20px}
.card h3{margin:0 0 7px;font-size:17px}
.card p{margin:0;color:var(--muted);font-size:15px}
.card a.stretch{color:inherit}
.card a.stretch:hover{text-decoration:none}
.card a.stretch:hover h3{color:var(--accent-alt)}

.note{background:var(--panel);border:1px solid var(--border);border-left:3px solid var(--accent);
  border-radius:8px;padding:15px 19px;color:var(--muted);font-size:15px;margin:0 0 22px}
.note b,.note strong{color:var(--text)}
.note.ok{border-left-color:var(--ok)}
.pill{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;
  padding:3px 9px;border-radius:20px;border:1px solid var(--border);color:var(--faint)}
.pill.now{color:var(--ok);border-color:rgba(63,185,80,.4)}
.pill.next{color:var(--accent-alt);border-color:rgba(33,206,232,.35)}
.tags{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0 4px;padding:0;list-style:none}
.tags li{font-size:13px;color:var(--muted);background:var(--panel-2);
  border:1px solid var(--border);border-radius:6px;padding:3px 9px}

footer.site{border-top:1px solid var(--border);background:none;position:static;margin-top:56px}
.foot{padding:34px 0 46px;display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;align-items:flex-start}
.foot p{margin:0;color:var(--muted);font-size:15px;max-width:60ch}
.foot nav{display:flex;flex-wrap:wrap;gap:16px}
.foot nav a{color:var(--muted);font-size:15px}

@media(max-width:720px){
  .bar{height:auto;padding:12px 0;flex-wrap:wrap}
  .site nav{gap:2px}
  .hero{padding:48px 0 32px}
  h2{margin-top:38px}
}
"""


# ---------------------------------------------------------------------------
# Page content
# ---------------------------------------------------------------------------

def p_hero():
    return f"""
<section class="hero">
  <div class="wrap">
    <h1 class="logo">CMX</h1>
    <div class="rule"><i></i><i></i></div>
    <p class="tagline">{html.escape(TAGLINE)}</p>
    <p class="sub">A <b>~7&nbsp;MB</b> binary, <b>~95&nbsp;MB</b> resident memory and a
      <b>~2.4&nbsp;s</b> cold start — because CMX renders in the OS webview instead of bundling
      a browser.</p>
    <div class="cta">
      <a class="btn btn-p" href="{LATEST_URL}" rel="noopener">Download for macOS</a>
      <a class="btn btn-s" href="/downloads.html">All platforms</a>
      <a class="btn btn-s" href="{REPO_URL}" rel="noopener">Source on GitHub</a>
    </div>
  </div>
</section>

<p><a href="{REPO_URL}"><img class="shot"
  src="/screenshots/01-workspace-dark.png" width="1380" height="723" loading="lazy"
  alt="CMX code editor showing a dark-theme workspace with the file explorer open and syntax-highlighted TypeScript."></a></p>
"""


def p_home():
    body = p_hero() + """
<h2>Why CMX</h2>
<p>Most editors make you choose between native feel and speed. Electron apps feel
native but ship a browser runtime; web editors are fast but live in a tab. CMX uses
the operating system's own webview, so it gets both without owning a browser.</p>
<div class="grid">
  <div class="card"><h3>No bundled browser</h3><p>WebKit on macOS, WebKitGTK on Linux, WebView2 on
    Windows. Nothing extra to download, patch or ship.</p></div>
  <div class="card"><h3>Vim mode, three levels</h3><p>Off by default. Friendly adds hints and a
    forgiving Ex set; Expert gives the full motion vocabulary.</p></div>
  <div class="card"><h3>Workspace search</h3><p>Ripgrep's <code>ignore</code> walker, built in.
    Respects <code>.gitignore</code> with nothing to install.</p></div>
  <div class="card"><h3>Live preview</h3><p>Markdown, HTML and SVG rendered beside the source,
    split by a draggable resizer.</p></div>
  <div class="card"><h3>Quick Open</h3><p>A ranked file finder on <code>⌘P</code> and the command
    palette on <code>⌘⇧P</code>.</p></div>
  <div class="card"><h3>Large-file fast mode</h3><p>Files past 1.5&nbsp;MB or 25,000 lines drop to
    fast mode automatically, with a badge so you know.</p></div>
</div>

<h2>See it in action</h2>
<div class="grid">
  <div class="card"><figure>
    <img class="shot" src="/screenshots/03-quick-open.png" width="1380" height="723" loading="lazy"
      alt="CMX code editor showing the command palette and quick file search.">
    <figcaption><b>Quick Open</b> ranks files as you type. The command palette is on
      <code>⌘⇧P</code>.</figcaption>
  </figure></div>
  <div class="card"><figure>
    <img class="shot" src="/screenshots/04-search-preview.png" width="1380" height="723" loading="lazy"
      alt="CMX code editor showing workspace search results beside a rendered Markdown live preview.">
    <figcaption><b>Workspace search</b> groups matches with context. <b>Live preview</b> renders
      the document beside it.</figcaption>
  </figure></div>
</div>
<p><a href="/features.html">Read about every feature →</a></p>

<h2>Get CMX</h2>
<p>Prebuilt binaries exist for macOS on Apple Silicon today. Linux and Windows build
cleanly from source, and packaged installers for all three platforms are the next
release milestone.</p>
<p><a class="btn btn-p" href="/downloads.html">Installation instructions for all platforms</a></p>
"""
    return page(
        path="/index.html",
        title=f"{NAME} — A code editor with Vim mode, search and live preview",
        description=f"{NAME} is a code editor for {PLATFORMS} with Vim mode, workspace search "
                    "and live preview. No Electron, no bundled browser, ~7 MB binary.",
        h1="",
        body=body,
        extra_schema=[source_schema()],
    )


def p_features():
    body = """
<p class="lede">Everything CMX does, and what it deliberately leaves out. Measurements are on
the <a href="/performance.html">performance page</a>.</p>

<h2>Editing</h2>
<ul>
<li><b>CodeMirror 6 core.</b> Multiple cursors, bracket matching and closing, folding, a
  search-and-replace panel, highlighted selection matches and an active-line marker.</li>
<li><b>14 language grammars, loaded on demand.</b> JavaScript/TypeScript, Python, Rust,
  C/C++, Java, Go (via the C++ grammar), HTML, CSS, JSON, Markdown, SQL, XML, YAML, Shell and
  Dockerfile. Opening a Rust file never waits on the Python grammar.</li>
<li><b>Markdown with highlighted fenced code blocks</b> — headings, emphasis, code, quotes,
  lists and links.</li>
<li><b>Tab size</b> 2, 4 or 8; <b>word wrap</b>; zoom in, out and reset; six bundled monospace
  fonts. See <a href="/docs/configuration.html">configuration</a>.</li>
</ul>

<h2 id="large-files">Large files</h2>
<p>Files over <b>1.5&nbsp;MB</b> or <b>25,000 lines</b> automatically drop into fast mode:
parsing and decorative extras switch off so scrolling and editing stay smooth, and a
<code>⚡&nbsp;FAST</code> badge appears in the status bar so you always know which mode you are in.
Reopening a file above the threshold always starts in fast mode.</p>

<h2 id="vim-mode">Vim mode</h2>
<p>Three levels, switched from the status-bar pill or the command palette.</p>
<table>
<thead><tr><th>Level</th><th>What you get</th></tr></thead>
<tbody>
<tr><td>Off <span class="pill">default</span></td><td>A plain editor. Nothing is intercepted.</td></tr>
<tr><td>Friendly</td><td>Hints plus a forgiving Ex command set.</td></tr>
<tr><td>Expert</td><td>The full motion vocabulary.</td></tr>
</tbody>
</table>
<p>Ex commands: <code>:w</code> <code>:q</code> <code>:q!</code> <code>:wq</code> <code>:x</code>
<code>:e</code> <code>:noh</code> <code>:bd</code> <code>:new</code>, alongside a which-key style
hint bar and a mode pill reading <code>NORMAL</code>, <code>INSERT</code> or <code>VISUAL</code>.</p>

<h2>Navigation</h2>
<h3>File explorer</h3>
<p>Create, rename and delete files and folders inline; reveal in Finder or Explorer; open and
close a folder. The tree patches itself in place, so saving a file does not collapse and
re-expand the whole sidebar.</p>
<h3>Quick Open</h3>
<p>A ranked file finder over the open workspace on <code>⌘P</code>, with filename hits ranked
ahead of directory hits. The command palette is on <code>⌘⇧P</code> or <code>F1</code>, and
<code>:line[,col]</code> jumps straight to a position.</p>
<h3>Workspace search</h3>
<p><code>⌘⇧F</code> searches every file in the workspace and groups matches by file with two lines
of surrounding context. Results highlight the matched text and update on a 150&nbsp;ms debounce —
and when you keep typing, in-flight searches are cancelled rather than queued.</p>
<p>Search is implemented in Rust on ripgrep's <code>ignore</code> crate. It honours
<code>.gitignore</code> and global excludes and skips hidden files out of the box, and needs
<b>no external <code>rg</code> binary installed</b>.</p>
<h3>Tabs</h3>
<p>Dirty-state dots, per-tab scroll and memory, close one / right / others / all, and a
confirmation before discarding unsaved changes.</p>

<h2>Live preview</h2>
<p><code>⌘⇧V</code> renders the document beside the source, split by a resizer you can drag and
reset with a double-click.</p>
<ul>
<li><b>Markdown</b> — debounced, GitHub-flavored rendering.</li>
<li><b>HTML</b> — rendered in a sandboxed <code>&lt;iframe&gt;</code>, so the document cannot
  reach the filesystem.</li>
<li><b>SVG</b> — previewed in place.</li>
</ul>

<h2>Status bar</h3>
<p>Vim mode pill, detected language, <code>Ln</code>/<code>Col</code> that jumps to Go to Line and
reports the document's total line count, selection size, word-wrap state, encoding, and loading
and fast-mode indicators.</p>

<h2>What CMX does not do</h2>
<p>There is no plugin system that runs arbitrary native code, no built-in terminal multiplexer,
and no cloud sync — settings are a small file that belongs in your dotfiles repository. The
<a href="/contributing.html">roadmap</a> records what is being considered and why.</p>
"""
    return page(
        path="/features.html",
        title=f"Features — {NAME} code editor for macOS, Linux and Windows",
        description="Vim mode with three levels, .gitignore-aware workspace search, Quick Open, "
                    "large-file fast mode, and live preview for Markdown, HTML and SVG.",
        h1="Features",
        body=body,
        trail=[("Features", "/features.html")],
    )


def p_performance():
    body = f"""
<p class="lede">CMX publishes its benchmark harness in the repository so these numbers can be
checked, and anyone can reproduce them on their own machine.</p>

<h2>Reference results</h2>
<table>
<thead><tr><th>Metric</th><th>Value</th></tr></thead>
<tbody>
<tr><td>Cold start to ready</td><td>~2.4&nbsp;s</td></tr>
<tr><td>CPU — average</td><td>~0.1% of one core</td></tr>
<tr><td>CPU — peak</td><td>~1.3% of one core</td></tr>
<tr><td>Resident memory — average</td><td>~95&nbsp;MB</td></tr>
<tr><td>Resident memory — peak</td><td>~95&nbsp;MB</td></tr>
<tr><td>Peak memory vs physical RAM</td><td>~1.2%</td></tr>
</tbody>
</table>
<p>Reported as medians over five runs.</p>

<h2>Artifact sizes</h2>
<table>
<thead><tr><th>Artifact</th><th>Size</th></tr></thead>
<tbody>
<tr><td>Release binary</td><td>6.7&nbsp;MB</td></tr>
<tr><td><code>.app</code> bundle</td><td>6.9&nbsp;MB</td></tr>
<tr><td><code>.dmg</code> installer</td><td>3.6&nbsp;MB (3,797,048 bytes)</td></tr>
<tr><td>Initial JavaScript</td><td>~576&nbsp;KB raw / ~190&nbsp;KB gzipped</td></tr>
</tbody>
</table>
<p>There is no bundled Chromium in any of these numbers, because there is no bundled browser.</p>

<h2>Test hardware</h2>
<table>
<thead><tr><th>Property</th><th>Value</th></tr></thead>
<tbody>
<tr><td>Operating system</td><td>macOS</td></tr>
<tr><td>Architecture</td><td>Apple Silicon (arm64)</td></tr>
<tr><td>Physical memory</td><td>8&nbsp;GB</td></tr>
<tr><td>Build</td><td><code>pnpm tauri build</code> (release profile, LTO, <code>opt-level="s"</code>, symbols stripped)</td></tr>
<tr><td>Runs</td><td>5, reported as medians</td></tr>
</tbody>
</table>

<h2 id="methodology">Methodology</h2>
<p>The harness is <code>scripts/bench.mjs</code> in the
<a href="{REPO_URL}">repository</a>. It launches the release binary and samples it with
<code>ps</code>, rather than trusting a single end-to-end wall-clock reading.</p>
<ul>
<li><b>Sampling.</b> <code>ps -o pid=,%cpu=,rss=</code> every <b>150&nbsp;ms</b>. Where the binary
  spawns helper or webview processes, the highest-CPU process is tracked.</li>
<li><b>Ready detection.</b> Startup ends when CPU stays at or below <b>5%</b> for
  <b>4 consecutive</b> settle checks taken every <b>50&nbsp;ms</b>. This detects the end of the
  launch burst — JIT, first paint, preloads — rather than a fixed sleep. A <b>15&nbsp;s</b>
  hard cap prevents a hang from reading as a slow start.</li>
<li><b>Steady state.</b> Sampling continues for <b>5&nbsp;s</b> after ready (default;
  <code>--window</code> to change). Average and peak are taken over that window.</li>
<li><b>Statistics.</b> Median, mean, min and max. The published table uses the median.</li>
<li><b>Machine-readable output.</b> Each run emits a <code>__CMX_BENCH__</code> JSON line so CI can
  consume the numbers directly.</li>
</ul>
<p class="note"><b>Known limitations.</b> The harness reads <code>%CPU</code> and <code>RSS</code>
via <code>ps</code>, so it runs on macOS and Linux but not Windows. Total physical memory comes
from <code>sysctl hw.memsize</code>, which is macOS-only; elsewhere the comparison falls back to an
assumed 8&nbsp;GB. Treat the percentage-of-RAM figure as a macOS result.</p>

<h2>Reproduce</h2>
<pre><code>pnpm tauri build     # build the release binary first
pnpm bench --runs 5  # profile it</code></pre>
<table>
<thead><tr><th>Flag</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td><code>--runs &lt;n&gt;</code></td><td>Launches to average over (default 1).</td></tr>
<tr><td><code>--window &lt;ms&gt;</code></td><td>Sampling window after ready (default 5000).</td></tr>
<tr><td><code>--bin &lt;path&gt;</code></td><td>Explicit binary path, skipping auto-discovery.</td></tr>
</tbody>
</table>
<p>Numbers for a different machine, a different build or a different OS will differ — that is the
point. Please <a href="{REPO_URL}/issues/new/choose">open an issue</a> with your
<code>__CMX_BENCH__</code> output if you see something surprising.</p>
"""
    return page(
        path="/performance.html",
        title=f"Performance — {NAME} startup, memory and CPU benchmarks",
        description=f"Reproducible {NAME} benchmarks with full methodology: ~2.4 s cold start, "
                    "~95 MB resident memory, 6.7 MB release binary. Run pnpm bench to reproduce.",
        h1="Performance",
        body=body,
        trail=[("Performance", "/performance.html")],
    )


def p_downloads():
    body = f"""
<p class="lede">Latest stable release: <b>v{VERSION}</b>. CMX is free and MIT licensed — there is
no trial, no account and no telemetry.</p>
<p><a class="btn btn-p" href="{LATEST_URL}" rel="noopener">Open the latest release on GitHub</a></p>

<h2>Platform support</h2>
<p>This is the honest state of v{VERSION}. A download is listed only where a binary actually
exists.</p>
<table>
<thead><tr><th>Platform</th><th>Prebuilt download</th><th>Status</th></tr></thead>
<tbody>
<tr><td>macOS (Apple Silicon)</td><td><code>.dmg</code></td><td class="y">Available in every release</td></tr>
<tr><td>macOS (Intel)</td><td>—</td><td class="n">Build from source</td></tr>
<tr><td>Linux (x86_64)</td><td>—</td><td class="n">Build from source</td></tr>
<tr><td>Windows (x86_64)</td><td>—</td><td class="n">Build from source</td></tr>
</tbody>
</table>
<p class="note"><b>Linux and Windows are not second-class.</b> All three platforms build and run
today, and the CI workflow builds and tests all three on every push. Prebuilt installers for
Linux and Windows are tracked as the next <a href="/contributing.html#roadmap">release
milestone</a>.</p>

<h2 id="macos">macOS — Apple Silicon</h2>
<p>Download the <code>.dmg</code>, then drag <b>cmx editor</b> into Applications:</p>
<pre><code>curl -fLo cmx.dmg \\
  {DOWNLOAD_URL}
hdiutil attach cmx.dmg &amp;&amp; cp -R "cmx editor.app" /Applications/</code></pre>
<p>Launch it from Applications, or from the terminal:</p>
<pre><code>open -a "cmx editor" ~/your/project</code></pre>
<p class="note"><b>macOS builds are unsigned.</b> Gatekeeper will refuse to open it on first
launch. Right-click the app and choose <b>Open</b>, or run:
<br><code>xattr -dr com.apple.quarantine "/Applications/cmx editor.app"</code>
<br>Code signing and notarization are on the roadmap.</p>

<h2>Linux</h2>
<p>No <code>.deb</code> or AppImage is published yet, so build from source. Install the
WebKitGTK toolchain first:</p>
<pre><code># Debian / Ubuntu
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \\
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel libxdo-devel \\
  libappindicator-gtk3-devel librsvg2-devel</code></pre>
<p>Then follow <a href="/docs/development.html">developer setup</a>. You can produce local
packages immediately with <code>pnpm tauri build</code>, which writes <code>.deb</code>,
<code>.rpm</code> and AppImage to <code>src-tauri/target/release/bundle/</code>.</p>

<h2>Windows</h2>
<p>No installer is published yet, so build from source. You need
<a href="https://rustup.rs">Rust</a>, Node 20+ and the
<a href="https://developer.microsoft.com/microsoft-edge/webview2/">WebView2 runtime</a>, which is
pre-installed on Windows 11. From PowerShell:</p>
<pre><code>git clone {REPO_URL}.git
cd cmx
corepack enable
pnpm install
pnpm tauri dev</code></pre>

<h2>Verify what you downloaded</h2>
<p>Every published release includes a <code>CHECKSUMS.txt</code>:</p>
<pre><code>sha256sum -c CHECKSUMS.txt</code></pre>
<p>If a checksum does not match, do not run the file —
<a href="{REPO_URL}/issues/new/choose" rel="noopener">report it</a>.</p>

<h2>Other systems</h2>
<p>Package managers such as Homebrew, Scoop and the AUR are not yet publishing CMX. Please do not
add unofficial packages on the project's behalf — open an issue and we will help scope an
official one. The <a href="/docs.html">documentation</a> covers configuration once it is running.</p>
"""
    return page(
        path="/downloads.html",
        title=f"Download {NAME} — macOS, Linux and Windows",
        description=f"Download {NAME} {VERSION} for macOS, Linux and Windows. macOS Apple "
                    "Silicon ships a .dmg installer; Linux and Windows build from source.",
        h1="Download",
        body=body,
        trail=[("Download", "/downloads.html")],
    )


def p_docs():
    body = """
<p class="lede">Everything you need to run CMX day to day. The
<a href="https://github.com/chaitmudunuri/cmx">GitHub repository</a> remains the source of truth;
these pages cover the documentation that does not belong in a README.</p>
<div class="grid">
  <div class="card"><a class="stretch" href="/docs/installation.html"><h3>Installation</h3></a>
    <p>Get CMX running on macOS, Linux or Windows, and open your first folder.</p></div>
  <div class="card"><a class="stretch" href="/docs/shortcuts.html"><h3>Keyboard shortcuts</h3></a>
    <p>The complete keymap, with macOS and Windows/Linux bindings side by side.</p></div>
  <div class="card"><a class="stretch" href="/docs/configuration.html"><h3>Configuration</h3></a>
    <p>Themes, fonts, text size, tab size, Vim mode and where settings are stored.</p></div>
  <div class="card"><a class="stretch" href="/docs/troubleshooting.html"><h3>Troubleshooting</h3></a>
    <p>Gatekeeper, WebKitGTK, WebView2, performance and blank-window fixes.</p></div>
  <div class="card"><a class="stretch" href="/docs/development.html"><h3>Developer setup</h3></a>
    <p>Build from source, run the tests, and profile a release build.</p></div>
</div>

<h2>Where to go next</h2>
<p>If you are evaluating CMX, the <a href="/performance.html">performance page</a> has the
reproducible numbers and <a href="/features.html">features</a> covers what the editor does.
If you are evaluating whether to help, start with <a href="/contributing.html">contributing</a>.</p>
"""
    return page(
        path="/docs.html",
        title=f"Documentation — {NAME} code editor",
        description=f"{NAME} documentation: installation on macOS, Linux and Windows, keyboard "
                    "shortcuts, configuration, troubleshooting and developer setup.",
        h1="Documentation",
        body=body,
        trail=[("Docs", "/docs.html")],
    )


def p_installation():
    body = f"""
<p class="lede">CMX runs on macOS, Linux and Windows. Prebuilt binaries exist for macOS on Apple
Silicon; the other platforms build from source in about two minutes.</p>

<h2>macOS</h2>
<h3>1. Download</h3>
<p>Grab the <code>.dmg</code> from the
<a href="{RELEASES_URL}/latest">latest release</a>, or see
<a href="/downloads.html#macos">the download page</a> for a copy-pasteable command.</p>
<h3>2. Install</h3>
<p>Open the <code>.dmg</code> and drag <b>cmx editor</b> into Applications.</p>
<h3>3. First launch</h3>
<p>CMX is not code-signed, so macOS blocks it on first run. Either right-click the app and choose
<b>Open</b>, or run:</p>
<pre><code>xattr -dr com.apple.quarantine "/Applications/cmx editor.app"</code></pre>
<h3>4. Open a folder</h3>
<p>Launch CMX, then use <b>Open folder</b> in the file explorer to point it at a project. CMX
restores your last session — open tabs, folder and untitled buffers — on next launch.</p>

<h2 id="linux">Linux</h2>
<h3>1. Install the toolchain</h3>
<p>CMX renders through WebKitGTK, so its build and runtime dependencies must be present:</p>
<pre><code># Debian / Ubuntu
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \\
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel libxdo-devel \\
  libappindicator-gtk3-devel librsvg2-devel</code></pre>
<h3>2. Install Rust and Node</h3>
<pre><code>curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs</code></pre>
<h3>3. Build</h3>
<pre><code>git clone {REPO_URL}.git
cd cmx
corepack enable &amp;&amp; corepack prepare pnpm@latest --activate
pnpm install
pnpm tauri build</code></pre>
<p>Bundles land in <code>src-tauri/target/release/bundle/</code>.</p>

<h2>Windows</h2>
<h3>1. Install the prerequisites</h3>
<p>Install <a href="https://rustup.rs">Rust</a> and
<a href="https://nodejs.org">Node 20+</a>. The
<a href="https://developer.microsoft.com/microsoft-edge/webview2/">WebView2 runtime</a> is
pre-installed on Windows 11; on Windows 10 install the Evergreen runtime.</p>
<p>Building the NSIS installer additionally needs the
<a href="https://visualstudio.microsoft.com/downloads/">Visual Studio Build Tools</a> with the
<b>Desktop development with C++</b> workload.</p>
<h3>2. Build</h3>
<pre><code>git clone {REPO_URL}.git
cd cmx
corepack enable
pnpm install
pnpm tauri dev      # try it without a full bundle</code></pre>
<h3>3. Package</h3>
<pre><code>pnpm tauri build --bundles nsis</code></pre>

<h2>Updating</h2>
<p>CMX does not self-update. Replace the binary or re-run the installer from the
<a href="{RELEASES_URL}/latest">latest release</a>. Your settings live in local storage and survive
an upgrade.</p>

<h2>If something goes wrong</h2>
<p>See <a href="/docs/troubleshooting.html">troubleshooting</a>. If it is not covered there,
<a href="{REPO_URL}/issues/new/choose" rel="noopener">open an issue</a> with your platform and
version.</p>
"""
    return page(
        path="/docs/installation.html",
        title=f"Install {NAME} on macOS, Linux and Windows",
        description=f"Install {NAME} on macOS, Linux and Windows, including Gatekeeper, WebKitGTK "
                    "and WebView2 prerequisites, and how to open your first folder.",
        h1="Installation",
        body=body,
        trail=[("Docs", "/docs.html"), ("Installation", "/docs/installation.html")],
    )


def p_shortcuts():
    body = """
<p class="lede">Every binding CMX ships with. On Windows and Linux, <code>Cmd</code> becomes
<code>Ctrl</code>.</p>
<table>
<thead><tr><th>macOS</th><th>Windows / Linux</th><th>Action</th></tr></thead>
<tbody>
<tr><td><code>⌘P</code></td><td><code>Ctrl+P</code></td><td>Quick Open — ranked file finder</td></tr>
<tr><td><code>⌘⇧P</code></td><td><code>Ctrl+Shift+P</code> / <code>F1</code></td><td>Command palette</td></tr>
<tr><td><code>⌘⇧F</code></td><td><code>Ctrl+Shift+F</code></td><td>Workspace search</td></tr>
<tr><td><code>⌘⇧V</code></td><td><code>Ctrl+Shift+V</code></td><td>Toggle live preview (Markdown, HTML, SVG)</td></tr>
<tr><td><code>⌘S</code></td><td><code>Ctrl+S</code></td><td>Save (save-as for untitled files)</td></tr>
<tr><td><code>⌘O</code></td><td><code>Ctrl+O</code></td><td>Open file</td></tr>
<tr><td><code>⌘B</code></td><td><code>Ctrl+B</code></td><td>Toggle sidebar</td></tr>
<tr><td><code>⌘N</code></td><td><code>Ctrl+N</code></td><td>New file</td></tr>
<tr><td><code>⌘G</code></td><td><code>Ctrl+G</code></td><td>Go to line and column</td></tr>
<tr><td><code>⌘,</code></td><td><code>Ctrl+,</code></td><td>Settings</td></tr>
<tr><td><code>⌘⇧E</code></td><td><code>Ctrl+Shift+E</code></td><td>Show the file explorer</td></tr>
<tr><td><code>⌘=</code></td><td><code>Ctrl+=</code></td><td>Zoom in</td></tr>
<tr><td><code>⌘-</code></td><td><code>Ctrl+-</code></td><td>Zoom out</td></tr>
<tr><td><code>⌘0</code></td><td><code>Ctrl+0</code></td><td>Reset zoom</td></tr>
<tr><td><code>⌥Z</code></td><td><code>Alt+Z</code></td><td>Toggle word wrap</td></tr>
<tr><td><code>Esc</code></td><td><code>Esc</code></td><td>Dismiss dialogs — never cancels typing</td></tr>
</tbody>
</table>

<h2 id="vim-mode">Vim mode</h2>
<p>When Vim mode is enabled, CMX's own bindings stay available and modal editing takes over in the
editor. Ex commands include:</p>
<pre><code>:w    save          :noh   clear search highlight
:q    close         :bd    close buffer
:q!   close, discard changes
:wq   save and close
:x    save and close
:e    reload
:new  new buffer</code></pre>
<p>The status bar shows the current mode (<code>NORMAL</code>, <code>INSERT</code>,
<code>VISUAL</code>), and a which-key style hint bar appears while <code>Friendly</code> or
<code>Expert</code> mode is active.</p>
<p>See <a href="/features.html#vim-mode">Vim mode</a> for what each level includes.</p>
"""
    return page(
        path="/docs/shortcuts.html",
        title=f"{NAME} keyboard shortcuts — macOS and Windows/Linux",
        description=f"The complete {NAME} keymap with macOS and Windows/Linux bindings, plus the "
                    "Vim mode Ex command reference.",
        h1="Keyboard shortcuts",
        body=body,
        trail=[("Docs", "/docs.html"), ("Keyboard shortcuts", "/docs/shortcuts.html")],
    )


def p_configuration():
    body = f"""
<p class="lede">Open settings with <code>⌘,</code>. Changes save automatically — there is no save
button and no settings file to edit.</p>
<p><a href="{REPO_URL}"><img class="shot"
  src="/screenshots/05-settings.png" width="1380" height="723" loading="lazy"
  alt="CMX code editor showing the settings dialog with Vim mode, text size, tab size and font options."></a></p>

<h2>Settings</h2>
<table>
<thead><tr><th>Setting</th><th>Options</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Vim keybindings</td><td>Off / Friendly / Expert</td><td>Off by default. Also switchable from the status-bar pill.</td></tr>
<tr><td>Text size</td><td>Increments</td><td>Also on <code>⌘=</code>, <code>⌘-</code> and <code>⌘0</code>.</td></tr>
<tr><td>Tab size</td><td>2, 4 or 8</td><td>Applies to new indentation; visual guides follow.</td></tr>
<tr><td>Font</td><td>Six bundled monospace faces</td><td>Previewed live as you move through the list.</td></tr>
<tr><td>Theme</td><td>Dark or Light</td><td>Switches instantly without losing state, cursor position or scroll.</td></tr>
<tr><td>Word wrap</td><td>On or off</td><td>Also on <code>⌥Z</code>. Shown in the status bar.</td></tr>
</tbody>
</table>

<h2>Fonts</h2>
<p>CMX bundles six monospace faces and renders them without a network round trip:</p>
<ul class="tags">
<li>JetBrains Mono</li><li>Fira Code</li><li>Source Code Pro</li>
<li>Cascadia Code</li><li>SF Mono / Menlo</li><li>Consolas</li>
</ul>
<p>JetBrains Mono is the default and is the one with ligatures enabled.</p>

<h2>Where settings live</h2>
<p>Settings are written to web storage in the app's local data directory, keyed by
<code>cmx_*</code> entries. They persist across upgrades and are not synced between machines.
CMX deliberately has no account system and sends no telemetry, so there is nothing to sign in to
and nothing to lose.</p>
<p class="note">Portable configuration profiles are on the
<a href="/contributing.html#roadmap">roadmap</a>, not yet implemented. If you want settings under
version control today, note the storage keys above and script them.</p>

<h2>Theme</h2>
<p>Two themes ship with CMX: a dark theme and a GitHub-style light theme. CMX applies the theme
before first paint, so there is no flash of the wrong colours on launch.</p>
"""
    return page(
        path="/docs/configuration.html",
        title=f"Configure {NAME} — themes, fonts, text size and Vim mode",
        description=f"Configure {NAME}: dark and light themes, six bundled monospace fonts, text "
                    "size, tab size, word wrap and the three Vim mode levels.",
        h1="Configuration",
        body=body,
        trail=[("Docs", "/docs.html"), ("Configuration", "/docs/configuration.html")],
    )


def p_troubleshooting():
    body = f"""
<p class="lede">The problems people actually hit, and what to do about them. If yours is not
here, <a href="{REPO_URL}/issues/new/choose" rel="noopener">open an issue</a> — Linux and Windows
reports are especially welcome, since neither platform has a prebuilt binary yet.</p>

<h2>macOS</h2>
<h3>"CMX is damaged and can't be opened"</h3>
<p>Gatekeeper is blocking an unsigned build. Right-click the app and choose <b>Open</b>, or:</p>
<pre><code>xattr -dr com.apple.quarantine "/Applications/cmx editor.app"</code></pre>
<h3>Blank or white window</h3>
<p>macOS caches web content. Quit CMX fully and relaunch. If it persists, clear the webview cache
by removing <code>~/Library/WebKit/com.cmx.editor</code> — settings are stored separately and will
survive.</p>
<h3>The app is slow to start on first launch</h3>
<p>macOS Gatekeeper checks the unsigned binary on first launch only. Subsequent launches skip it.</p>

<h2>Linux</h2>
<h3><code>libwebkit2gtk-4.1.so.0: cannot open shared object file</code></h3>
<p>WebKitGTK 4.1 is missing or too old. Install the development packages — see
<a href="/docs/installation.html#linux">Linux installation</a>.</p>
<h3>Blank window</h3>
<p>Check that the appindicator and librsvg libraries are present; some minimal desktop images omit
them. Also confirm the session is not running Wayland without a working WebKitGTK portal.</p>

<h2>Windows</h2>
<h3>The window never appears</h3>
<p>The WebView2 runtime is missing or broken. Install the
<a href="https://developer.microsoft.com/microsoft-edge/webview2/">Evergreen runtime</a> and
relaunch.</p>
<h3>Build fails with a linker error</h3>
<p>Install the Visual Studio Build Tools with the <b>Desktop development with C++</b> workload, then
restart the shell so the toolchain is on <code>PATH</code>.</p>

<h2>Any platform</h2>
<h3>Large file opened slowly, or shows a FAST badge</h3>
<p>This is working as designed. Files over 1.5&nbsp;MB or 25,000 lines drop into fast mode with
parsing off. See <a href="/features.html#large-files">large files</a>.</p>
<h3>Search returns nothing for a file I know contains the text</h3>
<p>Workspace search honours <code>.gitignore</code> and skips hidden files. A file excluded by
either will not match — that is deliberate, not a bug.</p>
<h3>Accented or pasted characters display incorrectly</h3>
<p>Check the encoding indicator in the status bar. CMX opens files as UTF-8 and falls back
gracefully; a mis-encoded file may need re-saving as UTF-8 in another tool.</p>
<h3>CMX will not close</h3>
<p>Unsaved changes prompt for confirmation. <code>Esc</code> dismisses dialogs and never cancels
your typing, so it will not discard a buffer for you.</p>

<h2>Reporting a bug</h2>
<p>Include your CMX version, OS and architecture, what you expected, what happened, and minimal
reproduction steps. Logs from the developer console help. Use the
<a href="{REPO_URL}/issues/new/choose" rel="noopener">bug report template</a>.</p>
"""
    return page(
        path="/docs/troubleshooting.html",
        title=f"Troubleshooting {NAME} — macOS, Linux and Windows fixes",
        description=f"Fix common {NAME} problems: macOS Gatekeeper and unsigned builds, missing "
                    "WebKitGTK on Linux, WebView2 on Windows, and large-file fast mode.",
        h1="Troubleshooting",
        body=body,
        trail=[("Docs", "/docs.html"), ("Troubleshooting", "/docs/troubleshooting.html")],
    )


def p_development():
    body = f"""
<p class="lede">Build CMX from source, run the tests, and profile a release build. The repository
is at <a href="{REPO_URL}">{REPO_URL}</a>.</p>

<h2>Prerequisites</h2>
<ul>
<li><a href="https://nodejs.org">Node 20+</a> with <a href="https://pnpm.io">pnpm</a></li>
<li><a href="https://rustup.rs">Rust stable</a> — macOS also needs <code>xcode-select --install</code></li>
<li>Linux also needs the WebKitGTK toolchain — see
<a href="/docs/installation.html#linux">Linux installation</a></li>
</ul>
<p>The full platform list is maintained by the
<a href="https://v2.tauri.app/start/prerequisites/">Tauri project</a>.</p>

<h2>Run it</h2>
<pre><code>git clone {REPO_URL}.git
cd cmx
pnpm install
pnpm tauri dev      # Vite + Tauri with hot reload at http://127.0.0.1:1420</code></pre>
<p>Useful while developing:</p>
<pre><code>pnpm dev           # frontend only, no native shell
pnpm build         # production frontend bundle
pnpm tauri build   # full release bundles for this platform</code></pre>

<h2>Checks</h2>
<pre><code>npx tsc --noEmit                    # frontend typecheck
pnpm build                           # production build
cd src-tauri &amp;&amp; cargo test         # Rust unit tests
cd src-tauri &amp;&amp; cargo clippy -- -D warnings</code></pre>
<p>CI runs the typecheck, the frontend build and the Rust tests on every push across Linux,
macOS and Windows.</p>

<h2>Benchmarks</h2>
<pre><code>pnpm tauri build     # the harness profiles the release binary
pnpm bench --runs 5</code></pre>
<p>The harness samples the running binary and prints medians, plus a machine-readable
<code>__CMX_BENCH__</code> JSON line. Full methodology is on the
<a href="/performance.html#methodology">performance page</a>.</p>

<h2>Project layout</h2>
<table>
<thead><tr><th>Path</th><th>Contents</th></tr></thead>
<tbody>
<tr><td><code>src/</code></td><td>Solid.js frontend. <code>App.tsx</code> wires shortcuts, themes, modals and layout.</td></tr>
<tr><td><code>src/components/</code></td><td><code>Editor.tsx</code> owns the CodeMirror lifecycle; <code>Sidebar.tsx</code>, <code>QuickOpen.tsx</code>, <code>LivePreview.tsx</code> and the status and title bars.</td></tr>
<tr><td><code>src/stores/editor.ts</code></td><td>Central signal store: files, tree, search, settings, session.</td></tr>
<tr><td><code>src-tauri/src/</code></td><td><code>main.rs</code> sets up Tauri and native menus; <code>commands.rs</code> holds file IO, directory listing, file search, workspace search and preview.</td></tr>
<tr><td><code>scripts/</code></td><td>Benchmark harness, screenshot capture, and the generator for this website and the social preview.</td></tr>
<tr><td><code>docs/</code></td><td>This website, plus the README screenshots.</td></tr>
</tbody>
</table>

<h2>Contributing</h2>
<p>See <a href="/contributing.html">contributing</a> for the commit style, review expectations
and code of conduct, or the repository's
<a href="{REPO_URL}/blob/main/CONTRIBUTING.md">CONTRIBUTING.md</a> directly.</p>
"""
    return page(
        path="/docs/development.html",
        title=f"Developer setup — building {NAME} from source",
        description=f"Build {NAME} from source: prerequisites, pnpm tauri dev, the typecheck and "
                    "cargo test suite, the benchmark harness and the project layout.",
        h1="Developer setup",
        body=body,
        trail=[("Docs", "/docs.html"), ("Developer setup", "/docs/development.html")],
    )


def p_contributing():
    body = f"""
<p class="lede">CMX is pre-1.0 and shaped by the people who use it. Bug reports, platform testing
and ideas are all genuinely useful — you do not need a finished patch to start.</p>

<h2 id="good-first-issue">Good first contributions</h2>
<p>These are the highest-value things you can do right now, in rough order of usefulness:</p>
<ol>
<li><b>Test a build on Linux or Windows.</b> Neither platform has a prebuilt binary and no
maintainer coverage. <a href="{REPO_URL}/issues/new/choose">Open an issue</a> with your
distribution, desktop environment and what broke — even "it works" is data.</li>
<li><b>Report an editor-fidelity bug.</b> Vim motions, CodeMirror behaviour and large-file
handling are where a careful user finds edge cases.</li>
<li><b>Find a search regression.</b> Workspace search is subtle: <code>.gitignore</code> handling,
binary files, very long lines and cancellation are easy to get wrong.</li>
<li><b>Improve the documentation.</b> If something confused you, it will confuse the next person.</li>
<li><b>Recapture a screenshot.</b> Follow the
<a href="{REPO_URL}/blob/main/docs/screenshots/SHOT-LIST.md">capture guide</a>.</li>
</ol>
<p>Looking for an open problem? The <a href="{REPO_URL}/issues" rel="noopener">issue tracker</a> is
the source of truth.</p>

<h2 id="roadmap">Roadmap</h2>
<p>The next release milestone is <b>v0.2.0 — packaging for all three platforms</b>: a macOS
universal binary, published Linux and Windows installers, code signing, notarization and release
checksums. After that: language-server support in v0.3.0, and a plugin API in v0.4.0.</p>
<p>The full roadmap is <a href="{REPO_URL}/blob/main/ROADMAP.md">ROADMAP.md</a>, including what CMX
deliberately will not do and why.</p>

<h2 id="setup">Development setup</h2>
<p>Node 20+ with pnpm, Rust stable, and the WebKitGTK toolchain on Linux. Full instructions are on
the <a href="/docs/development.html">developer setup page</a>.</p>
<pre><code>git clone {REPO_URL}.git
cd cmx
pnpm install
pnpm tauri dev</code></pre>

<h2 id="pull-requests">Pull requests</h2>
<ol>
<li>Branch off <code>main</code> — <code>git checkout -b fix/vim-word-motions</code>.</li>
<li>Keep the diff focused. Unrelated cleanups make review slower for everyone; send them
separately.</li>
<li>Run the checks: <code>npx tsc --noEmit</code>, <code>pnpm build</code>,
<code>cargo test</code>.</li>
<li>Fill in the PR template and link the issue with <code>Fixes #123</code>.</li>
<li>Commit messages are imperative and capitalized: <code>Fix tab close preserving sibling
scroll position</code>.</li>
</ol>
<p>For a larger change, open an issue first so the approach can be agreed before the work is
done. Review is best-effort and may take a few days.</p>

<h2>Reporting bugs</h2>
<p>Include your CMX version, OS and architecture, what you expected, what happened instead, and
minimal reproduction steps. Use the <a href="{REPO_URL}/issues/new/choose" rel="noopener">bug
report template</a>. Questions that are not bugs belong in
<a href="{REPO_URL}/discussions" rel="noopener">Discussions</a>.</p>

<h2>Security issues</h2>
<p>Please do not open a public issue for a security problem. Report it privately through GitHub's
<a href="{REPO_URL}/security/advisories/new" rel="noopener">security advisory form</a>. The scope
and the response time are set out in the repository's
<a href="{REPO_URL}/blob/main/SECURITY.md">SECURITY.md</a>.</p>

<h2>Community</h2>
<p>Everyone participating is expected to follow the
<a href="{REPO_URL}/blob/main/CODE_OF_CONDUCT.md">Code of Conduct</a>, which is adapted from the
Contributor Covenant.</p>
"""
    return page(
        path="/contributing.html",
        title=f"Contributing to {NAME} — roadmap and good first issues",
        description=f"Contribute to {NAME}: good first issues, the v0.2.0 packaging milestone, "
                    "development setup, the pull-request process and the code of conduct.",
        h1="Contributing to CMX",
        body=body,
        trail=[("Contributing", "/contributing.html")],
        extra_schema=[source_schema()],
    )


def p_404():
    body = """
<p class="lede">That page does not exist. It may have moved, or the link may be wrong.</p>
<div class="grid">
  <div class="card"><a class="stretch" href="/"><h3>Home</h3></a><p>What CMX is and why.</p></div>
  <div class="card"><a class="stretch" href="/features.html"><h3>Features</h3></a>
    <p>Vim mode, workspace search, live preview and more.</p></div>
  <div class="card"><a class="stretch" href="/downloads.html"><h3>Download</h3></a>
    <p>Install instructions for macOS, Linux and Windows.</p></div>
  <div class="card"><a class="stretch" href="/docs.html"><h3>Documentation</h3></a>
    <p>Installation, shortcuts, configuration and troubleshooting.</p></div>
</div>
"""
    slug, doc = page(
        path="/404.html",
        title=f"Page not found — {NAME}",
        description="That page does not exist on the CMX website. Find CMX downloads, features, "
                    "performance benchmarks and documentation instead.",
        h1="Page not found",
        body=body,
    )
    # A 404 page must not be indexed.
    return slug, doc.replace('<meta name="theme-color" content="#141416">',
                             '<meta name="robots" content="noindex">\n<meta name="theme-color" content="#141416">')


# ---------------------------------------------------------------------------
# Sitemap, robots
# ---------------------------------------------------------------------------

SITEMAP_PRIORITY = {
    "/index.html": ("1.0", "weekly"),
    "/features.html": ("0.9", "monthly"),
    "/downloads.html": ("0.9", "weekly"),
    "/performance.html": ("0.7", "monthly"),
    "/docs.html": ("0.8", "monthly"),
    "/docs/installation.html": ("0.8", "monthly"),
    "/docs/shortcuts.html": ("0.6", "monthly"),
    "/docs/configuration.html": ("0.6", "monthly"),
    "/docs/troubleshooting.html": ("0.6", "monthly"),
    "/docs/development.html": ("0.6", "monthly"),
    "/contributing.html": ("0.6", "monthly"),
}


def sitemap_xml(pages: list[tuple[str, str]]) -> str:
    urls = []
    for path, _ in pages:
        if path == "/404.html":
            continue
        prio, freq = SITEMAP_PRIORITY.get(path, ("0.5", "monthly"))
        loc = f"{SITE_URL}/{path.lstrip('/')}"
        urls.append(
            f"  <url>\n"
            f"    <loc>{html.escape(loc)}</loc>\n"
            f"    <lastmod>{BUILD_DATE}</lastmod>\n"
            f'    <changefreq>{freq}</changefreq>\n'
            f"    <priority>{prio}</priority>\n"
            f"  </url>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )


ROBOTS = f"""User-agent: *
Allow: /

Sitemap: {SITE_URL}/sitemap.xml
"""


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

BUILDERS = [
    p_home, p_features, p_performance, p_downloads, p_docs,
    p_installation, p_shortcuts, p_configuration, p_troubleshooting,
    p_development, p_contributing, p_404,
]


def main() -> int:
    assets = OUT / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "site.css").write_text(CSS, encoding="utf-8")

    # Serve files verbatim; nothing here needs Jekyll's front-matter processing.
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    (OUT / "robots.txt").write_text(ROBOTS, encoding="utf-8")

    written: list[tuple[str, str]] = []
    for builder in BUILDERS:
        slug, doc = builder()
        target = OUT / slug
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(doc, encoding="utf-8")
        written.append((f"/{slug}", slug))

    (OUT / "sitemap.xml").write_text(sitemap_xml(written), encoding="utf-8")

    for path, slug in written:
        size = (OUT / slug).stat().st_size
        print(f"  {slug:<28} {size:>6,} bytes")
    print(f"\n  sitemap.xml, robots.txt, .nojekyll, assets/site.css written to {OUT.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())