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

import argparse
import datetime
import html
import pathlib
import re
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"

# ---------------------------------------------------------------------------
# Site configuration — change SITE_URL to move to a custom domain
# ---------------------------------------------------------------------------

SITE_URL = "https://chaitmudunuri.github.io/cmx"
BASE_PATH = urllib.parse.urlparse(SITE_URL).path.rstrip("/")
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

TAGLINE = ("A lightweight code editor engineered for speed. Powered by Rust and "
           "the native OS webview with Vim mode, workspace search, and live preview.")

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

# A contents rail only earns its space with enough sections to navigate.
MIN_TOC_ENTRIES = 3

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

def link(p: str) -> str:
    """Resolve an internal path against BASE_PATH."""
    if not p:
        return f"{BASE_PATH}/" if BASE_PATH else "/"
    if p.startswith(("http://", "https://", "mailto:", "data:", "#")):
        return p
    clean = "/" + p.lstrip("/")
    return f"{BASE_PATH}{clean}" if BASE_PATH else clean


def resolve_urls(html_text: str) -> str:
    """Rewrite root-relative href and src attributes to prepend BASE_PATH."""
    if not BASE_PATH:
        return html_text

    def repl(m: re.Match) -> str:
        attr = m.group(1)
        target = m.group(2)
        if target.startswith("/") and not target.startswith("//") and not target.startswith(f"{BASE_PATH}/"):
            return f'{attr}="{BASE_PATH}{target}"'
        return m.group(0)

    return re.sub(r'\b(href|src)="(/[^"]*)"', repl, html_text)


def nav_html(current: str) -> str:
    items = []
    for label, href in NAV:
        cls = ' class="on"' if href == current else ""
        dest = link(href)
        if href == "/docs.html":
            subs = "".join(
                f'<a href="{link(h)}">{html.escape(n)}</a>' for n, h in DOCS_NAV
            )
            items.append(
                f'<div class="has-sub"{cls}><a href="{dest}">{label}</a>'
                f'<div class="sub">{subs}</div></div>'
            )
        else:
            items.append(f'<a href="{dest}"{cls}>{label}</a>')
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
<meta name="color-scheme" content="light dark">

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

<script>
(function(){{
  try{{
    var t=localStorage.getItem('cmx-theme');
    if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);
  }}catch(e){{}}
}})();
</script>
<script>window.__CMX_BASE__ = "{BASE_PATH}";</script>
<link rel="stylesheet" href="{link('/assets/site.css')}">
<link rel="icon" href="https://raw.githubusercontent.com/{AUTHOR}/cmx/main/app-icon.svg" type="image/svg+xml">
<script defer src="{link('/assets/site.js')}"></script>
{ld}
</head>"""


def json_min(obj) -> str:
    import json
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def breadcrumbs_html(trail: list[tuple[str, str]]) -> str:
    parts = []
    for name, href in trail:
        parts.append(f'<li><a href="{link(href)}">{html.escape(name)}</a></li>')
    return f'<ol class="crumbs">{"".join(parts)}</ol>'


def auto_id_headings(body: str) -> str:
    """Give every <h2> and <h3> a stable id and a permalink anchor."""
    seen: set[str] = set()

    def repl(m: re.Match) -> str:
        tag, frag, inner = m.group(1), m.group(2), m.group(3)
        if not frag:
            clean = html.unescape(re.sub(r"<[^>]+>", "", inner)).strip()
            base = slug(clean)
            frag, n = base, 2
            while frag in seen:
                frag = f"{base}-{n}"
                n += 1
        seen.add(frag)
        anchor = f'<a class="heading-anchor" href="#{frag}" aria-label="Link to section">#</a>'
        return f'<{tag} id="{frag}">{inner}{anchor}</{tag}>'

    return re.sub(r'<(h[23])(?: id="([^"]+)")?>(.*?)</\1>', repl, body, flags=re.S)


def slug(text: str) -> str:
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[\u0000-\u001f!-,./:;<=>?@\[\\\]^`{|}~]", "", text.lower())
    return text.strip().replace(" ", "-")


def extract_toc(body: str) -> list[tuple[str, str]]:
    """Build the on-page contents list from h2s that carry an explicit id.

    Deriving it from the body keeps navigation and content from drifting apart.
    """
    out = []
    for frag, title in re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body, re.S):
        clean = html.unescape(re.sub(r"<[^>]+>", "", title)).strip().rstrip("#").strip()
        out.append((frag, clean))
    return out


def page(*, path: str, title: str, description: str, h1: str, body: str,
         og_type: str = "website", trail: list[tuple[str, str]] | None = None,
         extra_schema: list[dict] | None = None, show_toc: bool | None = None) -> tuple[str, str]:
    canonical = f"{SITE_URL}{path if path.endswith('.html') else path + '/'}"
    schemas = list(extra_schema or [])
    if trail:
        schemas.append(breadcrumb_schema(trail))
    schemas.append(software_schema())

    crumb_html = breadcrumbs_html(trail) if trail else ""
    h1_html = f"<h1>{h1}</h1>" if h1 else ""

    body = auto_id_headings(body)
    toc = extract_toc(body)

    if show_toc is None:
        show_toc = len(toc) >= MIN_TOC_ENTRIES and path != "/index.html"

    if show_toc:
        items = "".join(f'<li><a href="#{f}">{html.escape(t)}</a></li>' for f, t in toc)
        aside = (f'<aside class="aside"><nav class="toc" aria-label="On this page">'
                 f'<p class="toc-title">On this page</p><ol>{items}</ol>'
                 f'</nav></aside>')
        content = (f'{h1_html}<div class="layout"><article>{body}</article>'
                   f'{aside}</div>')
    else:
        cls = "landing" if path == "/index.html" else ""
        content = f'<article class="{cls}">{h1_html}{body}</article>'

    doc = f"""{head(title, description, canonical, og_type, schemas)}
<body>
<a href="#main" class="skip-link">Skip to main content</a>
<header class="site">
  <div class="wrap bar">
    <div class="bar-left">
      <a class="brand" href="{link('/')}">CMX</a>
      <button id="search-btn" class="search-btn" type="button" aria-label="Search documentation" title="Search documentation (⌘K)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Search</span>
        <kbd class="kbd-hint">⌘K</kbd>
      </button>
    </div>
    <div class="bar-right">
      <nav id="site-nav" class="nav-menu" aria-label="Main">{nav_html(path)}</nav>
      <button id="theme-toggle" class="theme-btn" type="button" aria-label="Toggle theme" title="Toggle theme">
        <svg class="sun-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        <svg class="moon-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      </button>
      <button id="nav-toggle" class="nav-toggle" type="button" aria-label="Toggle navigation menu" aria-expanded="false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
    </div>
  </div>
</header>
<main id="main">
  <div class="wrap">
{crumb_html}
{content}
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
      <a href="{link('/features.html')}">Features</a>
      <a href="{link('/performance.html')}">Performance</a>
      <a href="{link('/downloads.html')}">Download</a>
      <a href="{link('/docs.html')}">Docs</a>
      <a href="{link('/contributing.html')}">Contributing</a>
      <a href="{REPO_URL}">GitHub</a>
    </nav>
  </div>
</footer>
<div id="search-modal" class="search-modal" hidden>
  <div class="search-backdrop"></div>
  <div class="search-box" role="dialog" aria-modal="true" aria-label="Search documentation">
    <div class="search-head">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input id="search-input" class="search-input" type="search" placeholder="Search docs, features, shortcuts... (Esc to close)" autocomplete="off" spellcheck="false">
      <kbd class="search-esc">ESC</kbd>
    </div>
    <div id="search-results" class="search-results"></div>
    <div class="search-foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
      <span><kbd>↵</kbd> select</span>
      <span><kbd>ESC</kbd> close</span>
    </div>
  </div>
</div>
</body>
</html>
"""
    slug = path.lstrip("/") or "index.html"
    doc = resolve_urls(doc)
    return f"{slug}.html" if not slug.endswith(".html") else slug, doc


# ---------------------------------------------------------------------------
# Stylesheet
# ---------------------------------------------------------------------------

CSS = r"""
/* ------------------------------------------------------------------ *
 * CMX website stylesheet.
 * Light and dark are both first-class. The OS preference wins by default,
 * with manual override via data-theme attribute on <html>.
 * ------------------------------------------------------------------ */

:root{
  color-scheme: light dark;

  --bg:#ffffff;
  --surface:#f6f8fa;
  --surface-2:#eef1f4;
  --border:#d8dee4;
  --border-strong:#b9c1ca;
  --text:#1f2328;
  --text-soft:#57606a;
  --text-faint:#818b98;
  --accent:#0969da;
  --accent-soft:#ddf4ff;
  --accent-text:#0550ae;
  --accent-2:#1a7f37;
  --code-bg:#eff1f3;
  --shadow:0 1px 3px rgba(31,35,40,.08), 0 8px 24px rgba(31,35,40,.06);
  --shadow-lg:0 2px 6px rgba(31,35,40,.10), 0 16px 40px rgba(31,35,40,.10);
  --ring:#0969da33;
  --accent-wash:9,105,218;
  --radius:12px;
}

@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#0d1117;
    --surface:#161b22;
    --surface-2:#1c2330;
    --border:#30363d;
    --border-strong:#4a5560;
    --text:#e6edf3;
    --text-soft:#a8b3bf;
    --text-faint:#7d8792;
    --accent:#4493f8;
    --accent-soft:#121d2f;
    --accent-text:#6cb6ff;
    --accent-2:#3fb950;
    --code-bg:#1b2028;
    --shadow:0 1px 3px rgba(1,4,9,.5), 0 8px 24px rgba(1,4,9,.4);
    --shadow-lg:0 2px 8px rgba(1,4,9,.6), 0 18px 44px rgba(1,4,9,.5);
    --ring:#4493f855;
    --accent-wash:68,147,248;
  }
}

html[data-theme="dark"]{
  --bg:#0d1117;
  --surface:#161b22;
  --surface-2:#1c2330;
  --border:#30363d;
  --border-strong:#4a5560;
  --text:#e6edf3;
  --text-soft:#a8b3bf;
  --text-faint:#7d8792;
  --accent:#4493f8;
  --accent-soft:#121d2f;
  --accent-text:#6cb6ff;
  --accent-2:#3fb950;
  --code-bg:#1b2028;
  --shadow:0 1px 3px rgba(1,4,9,.5), 0 8px 24px rgba(1,4,9,.4);
  --shadow-lg:0 2px 8px rgba(1,4,9,.6), 0 18px 44px rgba(1,4,9,.5);
  --ring:#4493f855;
  --accent-wash:68,147,248;
}

html[data-theme="light"]{
  --bg:#ffffff;
  --surface:#f6f8fa;
  --surface-2:#eef1f4;
  --border:#d8dee4;
  --border-strong:#b9c1ca;
  --text:#1f2328;
  --text-soft:#57606a;
  --text-faint:#818b98;
  --accent:#0969da;
  --accent-soft:#ddf4ff;
  --accent-text:#0550ae;
  --accent-2:#1a7f37;
  --code-bg:#eff1f3;
  --shadow:0 1px 3px rgba(31,35,40,.08), 0 8px 24px rgba(31,35,40,.06);
  --shadow-lg:0 2px 6px rgba(31,35,40,.10), 0 16px 40px rgba(31,35,40,.10);
  --ring:#0969da33;
  --accent-wash:9,105,218;
}

*,*::before,*::after{box-sizing:border-box}
img{max-width:100%;height:auto}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:84px}
body{
  margin:0;
  background:var(--bg);
  color:var(--text);
  font:17px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  transition:background-color .2s ease,color .2s ease;
}
.wrap{max-width:1120px;margin:0 auto;padding:0 28px}

.skip-link{
  position:absolute;top:-48px;left:24px;background:var(--accent);color:#fff;
  padding:10px 16px;border-radius:0 0 8px 8px;font-weight:600;font-size:14px;
  z-index:100;transition:top .15s ease;text-decoration:none;
}
.skip-link:focus{top:0;text-decoration:none;color:#fff}

a{color:var(--accent-text);text-decoration:none;text-underline-offset:3px}
a:hover{text-decoration:underline}
:focus-visible{outline:3px solid var(--ring);outline-offset:2px;border-radius:6px}

/* --- type --------------------------------------------------------- */
h1,h2,h3,h4{line-height:1.18;letter-spacing:-.022em;margin:0}
h1{font-size:clamp(32px,4.6vw,46px);font-weight:800;margin-bottom:14px;letter-spacing:-.03em}
h2{font-size:clamp(22px,2.5vw,27px);font-weight:700;margin:60px 0 6px;letter-spacing:-.025em;position:relative}
h3{font-size:19px;font-weight:650;margin:38px 0 6px;position:relative}
p{margin:0 0 18px}
.lede{font-size:19px;line-height:1.65;color:var(--text-soft);max-width:62ch}
main > .wrap > p,
main > .wrap > ul,
main > .wrap > ol,
main > .wrap > pre,
main > .wrap > blockquote{max-width:74ch}
main ul,main ol{padding-left:24px}
main li{margin:.4em 0}
main li::marker{color:var(--text-faint)}

.heading-anchor{
  margin-left:8px;color:var(--text-faint);text-decoration:none;
  opacity:0;font-weight:normal;font-size:.82em;transition:opacity .15s ease,color .15s ease;
}
h2:hover .heading-anchor, h3:hover .heading-anchor, .heading-anchor:focus-visible{opacity:1}
.heading-anchor:hover{color:var(--accent-text);text-decoration:none}

code{
  font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  font-size:.87em;background:var(--code-bg);border:1px solid var(--border);
  border-radius:6px;padding:.14em .42em;
  overflow-wrap:anywhere;
}
pre{
  position:relative;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:18px 20px;overflow-x:auto;margin:0 0 20px;box-shadow:var(--shadow);
}
pre code{background:none;border:0;padding:0;white-space:pre;font-size:13.5px;line-height:1.65}

.code-copy-btn{
  position:absolute;top:10px;right:10px;
  background:var(--bg);border:1px solid var(--border);border-radius:6px;
  color:var(--text-soft);padding:4px 9px;font-size:12px;font-weight:600;
  cursor:pointer;opacity:0;transition:opacity .15s ease,background .15s ease,color .15s ease;
  display:inline-flex;align-items:center;gap:5px;line-height:1;
}
pre:hover .code-copy-btn, .code-copy-btn:focus-visible{opacity:1}
.code-copy-btn:hover{background:var(--surface-2);color:var(--text);border-color:var(--border-strong)}
.code-copy-btn.copied{color:var(--accent-2);border-color:var(--accent-2);opacity:1}

table{
  width:100%;border-collapse:separate;border-spacing:0;margin:6px 0 26px;
  font-size:15.5px;border:1px solid var(--border);border-radius:var(--radius);
  overflow:hidden;background:var(--bg);
}
th,td{text-align:left;padding:13px 18px;vertical-align:top}
thead th{
  background:var(--surface);color:var(--text-soft);font-weight:650;font-size:12.5px;
  text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border);
}
tbody tr + tr td{border-top:1px solid var(--border)}
td.y{color:var(--accent-2);font-weight:600;white-space:nowrap}
td.n{color:var(--text-faint);white-space:nowrap}

.badge{
  display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;padding:2px 9px;border-radius:999px;
  background:var(--accent-soft);color:var(--accent-text);border:1px solid var(--border);
}
.badge.fast{background:var(--code-bg);color:var(--text-soft)}

/* --- header ------------------------------------------------------- */
.site{
  background:color-mix(in srgb, var(--bg) 88%, transparent);
  border-bottom:1px solid var(--border);
  position:sticky;top:0;z-index:30;backdrop-filter:blur(12px) saturate(1.4);
  transition:background-color .2s ease,border-color .2s ease;
}
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;height:66px}
.bar-left{display:flex;align-items:center;gap:18px}
.bar-right{display:flex;align-items:center;gap:8px}

.brand{
  font-size:21px;font-weight:800;letter-spacing:-.035em;color:var(--text);
  display:inline-flex;align-items:center;gap:9px;
}
.brand::before{
  content:"";width:11px;height:11px;border-radius:3px;
  background:linear-gradient(135deg,var(--accent),#21cee8);
}
.brand:hover{text-decoration:none}

.search-btn{
  display:inline-flex;align-items:center;gap:8px;padding:6px 12px;
  background:var(--surface);border:1px solid var(--border);border-radius:8px;
  color:var(--text-soft);font-size:13.5px;cursor:pointer;
  transition:border-color .15s ease,background .15s ease,color .15s ease;
}
.search-btn:hover{background:var(--surface-2);border-color:var(--border-strong);color:var(--text)}
.search-btn .kbd-hint{
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:11px;background:var(--bg);border:1px solid var(--border);
  padding:1px 5px;border-radius:4px;color:var(--text-faint);
}

.theme-btn, .nav-toggle{
  display:inline-flex;align-items:center;justify-content:center;
  width:36px;height:36px;padding:0;background:var(--surface);
  border:1px solid var(--border);border-radius:8px;color:var(--text-soft);
  cursor:pointer;transition:all .15s ease;
}
.theme-btn:hover, .nav-toggle:hover{
  background:var(--surface-2);color:var(--text);border-color:var(--border-strong);
}
.nav-toggle{display:none}

.sun-icon{display:none}
.moon-icon{display:block}
html[data-theme="dark"] .sun-icon{display:block}
html[data-theme="dark"] .moon-icon{display:none}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .sun-icon{display:block}
  :root:not([data-theme="light"]) .moon-icon{display:none}
}
html[data-theme="light"] .sun-icon{display:none}
html[data-theme="light"] .moon-icon{display:block}

.site nav{display:flex;align-items:center;gap:2px}
.site nav a{
  padding:8px 13px;border-radius:8px;color:var(--text-soft);
  font-size:15px;font-weight:550;white-space:nowrap;
}
.site nav a:hover{background:var(--surface);color:var(--text);text-decoration:none}
.site nav a.on{color:var(--text);background:var(--surface-2);font-weight:650}
.site nav a.gh{
  background:var(--text);color:var(--bg);margin-left:8px;font-weight:650;
  border:1px solid var(--text);
}
.site nav a.gh:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
.has-sub{position:relative}
.has-sub .sub{
  display:none;position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);
  min-width:250px;background:var(--bg);border:1px solid var(--border);
  border-radius:12px;padding:7px;box-shadow:var(--shadow-lg);
}
.has-sub:hover .sub,.has-sub:focus-within .sub{display:block}
.has-sub .sub a{display:block;padding:9px 13px;color:var(--text-soft)}
.has-sub .sub a:hover{background:var(--surface);color:var(--text)}

/* --- hero --------------------------------------------------------- */
.hero{position:relative;padding:68px 0 44px}
.logo{
  font-size:clamp(50px,9vw,78px);font-weight:800;letter-spacing:-.045em;margin:0;
  background:linear-gradient(180deg,var(--text),color-mix(in srgb,var(--text) 78%,var(--accent)));
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.rule{display:flex;gap:9px;margin:20px 0 30px}
.rule i{display:block;height:6px;border-radius:999px}
.rule i:nth-child(1){width:70px;background:var(--accent)}
.rule i:nth-child(2){width:44px;background:#21cee8}
.tagline{font-size:clamp(22px,3vw,28px);font-weight:700;margin:0 0 16px;max-width:48ch;letter-spacing:-.025em;line-height:1.25}
.sub{color:var(--text-soft);font-size:18px;line-height:1.6;margin:0;max-width:62ch}

.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}
.btn{
  display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:10px;
  font-weight:650;font-size:15.5px;border:1px solid var(--border);
  transition:transform .12s ease,box-shadow .12s ease,background .12s ease;
}
.btn:hover{text-decoration:none;transform:translateY(-1px)}
.btn-p{background:var(--accent);color:#fff;border-color:transparent;box-shadow:var(--shadow)}
.btn-p:hover{background:color-mix(in srgb,var(--accent) 88%,black)}
.btn-s{background:var(--bg);color:var(--text)}
.btn-s:hover{background:var(--surface);box-shadow:var(--shadow)}

/* --- page body ---------------------------------------------------- */
main{padding:44px 0 20px;min-height:60vh}
.crumbs{
  list-style:none;display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:0 0 26px;
  font-size:14px;color:var(--text-faint);
}
.crumbs li+li::before{content:"/";margin-right:8px;color:var(--border-strong)}
.crumbs a{color:var(--text-faint)}
.crumbs a:hover{color:var(--text)}

.shot{width:100%;height:auto;aspect-ratio:1380/723;border:1px solid var(--border);border-radius:var(--radius);display:block;box-shadow:var(--shadow-lg)}
figure{margin:0 0 10px}
figcaption{color:var(--text-soft);font-size:15.5px;margin-top:10px}
figcaption b{color:var(--text)}

.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));margin:10px 0 8px;align-items:start}
.card{
  background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);
  padding:22px 24px;box-shadow:var(--shadow);
  transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease;
}
.card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg);border-color:var(--border-strong)}
.card h3{margin:0 0 8px;font-size:18px;font-weight:650}
.card p{margin:0;color:var(--text-soft);font-size:15.5px;line-height:1.62}
a.stretch{color:inherit;display:block}
a.stretch:hover{text-decoration:none}
a.stretch:hover h3{color:var(--accent-text)}

.note{
  background:var(--surface);border:1px solid var(--border);
  border-left:3px solid var(--accent);border-radius:10px;
  padding:16px 20px;color:var(--text-soft);font-size:15.5px;margin:0 0 24px;
}
.note b,.note strong{color:var(--text)}
.note.ok{border-left-color:var(--accent-2)}

.tags{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 6px;padding:0;list-style:none}
.tags li{
  font-size:14px;color:var(--text-soft);background:var(--surface);
  border:1px solid var(--border);border-radius:999px;padding:4px 13px;
}

/* --- footer ------------------------------------------------------- */
footer.site{border-top:1px solid var(--border);background:var(--surface);position:static;margin-top:70px}
.foot{padding:40px 0 52px;display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;align-items:flex-start}
.foot p{margin:0;color:var(--text-soft);font-size:15.5px;max-width:62ch}
.foot nav{display:flex;flex-wrap:wrap;gap:8px}
.foot nav a{color:var(--text-soft);font-size:15.5px;padding:6px 10px;border-radius:8px}
.foot nav a:hover{background:var(--bg);color:var(--text);text-decoration:none}

/* --- reading layout & landing ------------------------------------- */
.layout{display:grid;grid-template-columns:minmax(0,1fr) 236px;gap:56px;align-items:start}
.layout > article{min-width:0}
.aside{position:sticky;top:92px}
.toc{border-left:2px solid var(--border);padding-left:18px}
.toc-title{
  font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:var(--text-faint);margin:0 0 12px;
}
.toc ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.toc a{
  color:var(--text-soft);font-size:14.5px;line-height:1.45;display:block;
  transition:color .15s ease,border-color .15s ease;
  border-left:2px solid transparent;padding-left:10px;margin-left:-20px;
}
.toc a:hover{color:var(--text);text-decoration:none}
.toc a.active{color:var(--accent-text);font-weight:650;border-left-color:var(--accent)}

article > *{max-width:74ch}
article > .cards,article > table,article > figure,article > .note,article > ul.tags{width:100%;max-width:none}
article.landing > *{max-width:none}
article.landing .grid{margin:20px 0 32px}

figure.wide{margin:0 0 8px}
figure.wide .shot{width:100%;height:auto}

/* --- scannable card groups ---------------------------------------- */
.cards{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(272px,1fr));margin:14px 0 8px;align-items:start}
.cards .card{display:flex;flex-direction:column}
.cards .card h3{margin-top:0}
.cards .card p{margin:0}
.mini{list-style:none;padding:0;margin:12px 0 0;font-size:14.5px;color:var(--text-soft);display:flex;flex-direction:column;gap:6px}
.mini li{display:flex;gap:9px;align-items:flex-start;line-height:1.5}
.mini li::before{
  content:"";flex:none;width:5px;height:5px;border-radius:50%;
  background:var(--accent);margin-top:.62em;
}
.kbd{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:26px;height:24px;padding:0 7px;margin:0 1px;
  font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;
  font-size:12.5px;font-weight:600;color:var(--text);
  background:var(--surface);border:1px solid var(--border-strong);
  border-bottom-width:2px;border-radius:6px;
}
.exgrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:14px 0 8px;list-style:none;padding:0}
.exgrid li{
  background:var(--surface);border:1px solid var(--border);border-radius:8px;
  padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:14px;color:var(--text);text-align:center;
}
.exgrid li span{display:block;font-family:inherit;font-size:13px;color:var(--text-soft);margin-top:3px}

/* --- search modal ------------------------------------------------- */
.search-modal[hidden]{display:none}
.search-modal{position:fixed;inset:0;z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:12vh 20px 20px}
.search-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);animation:fadeIn .15s ease}
.search-box{
  position:relative;z-index:2;width:100%;max-width:580px;background:var(--bg);
  border:1px solid var(--border-strong);border-radius:14px;box-shadow:var(--shadow-lg);
  overflow:hidden;animation:popIn .18s cubic-bezier(.16,1,.3,1);display:flex;flex-direction:column;max-height:75vh;
}
.search-head{
  display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border);
  color:var(--text-soft);
}
.search-input{
  flex:1;background:transparent;border:0;outline:0;font-size:16px;color:var(--text);
  font-family:inherit;
}
.search-input::placeholder{color:var(--text-faint)}
.search-esc{
  font-size:11px;padding:2px 6px;border-radius:4px;border:1px solid var(--border);
  background:var(--surface);color:var(--text-faint);font-family:ui-monospace,Menlo,monospace;
}
.search-results{overflow-y:auto;padding:8px}
.search-item{
  display:flex;flex-direction:column;padding:10px 14px;border-radius:8px;
  color:var(--text);text-decoration:none;transition:background .12s ease;
}
.search-item:hover, .search-item.selected{background:var(--surface);text-decoration:none}
.search-item-title{font-size:14.5px;font-weight:600;display:flex;align-items:center;gap:8px}
.search-item-badge{
  font-size:11px;font-weight:600;text-transform:uppercase;color:var(--accent-text);
  background:var(--accent-soft);padding:1px 6px;border-radius:4px;
}
.search-item-desc{font-size:13px;color:var(--text-soft);margin-top:2px;line-height:1.4}
.search-empty{padding:28px 20px;text-align:center;color:var(--text-soft);font-size:14.5px}
.search-foot{
  display:flex;gap:16px;padding:10px 18px;background:var(--surface);border-top:1px solid var(--border);
  font-size:12px;color:var(--text-faint);
}
.search-foot kbd{
  font-family:ui-monospace,Menlo,monospace;font-size:11px;padding:1px 4px;background:var(--bg);
  border:1px solid var(--border);border-radius:3px;margin:0 2px;
}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{opacity:0;transform:scale(.96) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}

@media(max-width:960px){
  .layout{grid-template-columns:minmax(0,1fr);gap:0}
  .aside{position:static;margin:12px 0 24px;order:0}
  .toc{border-left:0;border:1px solid var(--border);border-radius:10px;padding:14px 18px;background:var(--surface)}
  .toc ol{flex-direction:row;flex-wrap:wrap;gap:6px 18px}
  .toc a{font-size:14px;border-left:0;padding-left:0;margin-left:0}
  .toc a.active{border-left:0;color:var(--accent-text);text-decoration:underline}
}

@media(max-width:760px){
  .wrap{padding:0 20px}
  .bar{height:62px;position:relative}
  .nav-toggle{display:inline-flex}
  .search-btn span, .search-btn .kbd-hint{display:none}
  .search-btn{padding:8px}
  .site nav{
    display:none;position:absolute;top:100%;left:0;right:0;
    background:var(--bg);border-bottom:1px solid var(--border);
    padding:14px 20px 20px;flex-direction:column;align-items:stretch;gap:6px;
    box-shadow:var(--shadow-lg);
  }
  .site.nav-open nav{display:flex}
  .site nav a{padding:10px 14px;font-size:15.5px;border-radius:8px}
  .site nav a.gh{margin-left:0;text-align:center;margin-top:8px}
  .has-sub .sub{
    display:flex;position:static;transform:none;box-shadow:none;
    border:0;border-left:2px solid var(--border);border-radius:0;
    margin:4px 0 6px 14px;padding:2px 0 2px 8px;flex-direction:column;gap:2px;
  }
  .has-sub .sub a{font-size:14px;padding:6px 10px}
  .hero{padding:56px 0 40px}
  h2{margin-top:46px}
  table{font-size:14.5px}
  th,td{padding:11px 13px}
}
@media print{
  .site,footer.site,.skip-link,.search-modal{display:none}
  body{background:#fff;color:#000}
}
"""

JS = r"""
(function() {
  'use strict';

  function initTheme() {
    var toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    function getTheme() {
      var saved = localStorage.getItem('cmx-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('cmx-theme', theme);
      var metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#0d1117' : '#ffffff');
    }

    toggleBtn.addEventListener('click', function() {
      var current = getTheme();
      var next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('cmx-theme')) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  function initCodeCopy() {
    var blocks = document.querySelectorAll('pre');
    blocks.forEach(function(pre) {
      var code = pre.querySelector('code');
      if (!code) return;

      var btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Copy code snippet');
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>Copy</span>';

      btn.addEventListener('click', function() {
        var text = code.innerText.replace(/\n$/, '');
        navigator.clipboard.writeText(text).then(function() {
          btn.classList.add('copied');
          btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>';
          setTimeout(function() {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>Copy</span>';
          }, 2000);
        });
      });

      pre.appendChild(btn);
    });
  }

  function initScrollSpy() {
    var tocLinks = document.querySelectorAll('.toc a[href^="#"]');
    if (!tocLinks.length) return;

    var headings = [];
    tocLinks.forEach(function(link) {
      var id = link.getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (el) headings.push({ id: id, el: el, link: link });
    });

    if (!headings.length) return;

    function onScroll() {
      var top = window.scrollY + 100;
      var active = headings[0];
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].el.getBoundingClientRect().top + window.scrollY <= top) {
          active = headings[i];
        }
      }
      tocLinks.forEach(function(l) { l.classList.remove('active'); });
      if (active) active.link.classList.add('active');
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initMobileNav() {
    var navToggle = document.getElementById('nav-toggle');
    var siteHeader = document.querySelector('header.site');
    if (!navToggle || !siteHeader) return;

    navToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var open = siteHeader.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', function(e) {
      if (!siteHeader.contains(e.target) && siteHeader.classList.contains('nav-open')) {
        siteHeader.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initSearch() {
    var searchBtn = document.getElementById('search-btn');
    var modal = document.getElementById('search-modal');
    var input = document.getElementById('search-input');
    var resultsBox = document.getElementById('search-results');
    if (!modal || !input || !resultsBox) return;

    var searchItems = [
      { t: "Home", d: "A lightweight code editor engineered for speed.", u: "/index.html", b: "Page" },
      { t: "Features Overview", d: "CodeMirror 6 core, multiple cursors, fast mode, syntax highlight, themes.", u: "/features.html", b: "Features" },
      { t: "Vim Mode", d: "Three levels: Off, Friendly, Expert. Ex command bar (:w, :q, :s, :noh).", u: "/features.html#vim-mode", b: "Vim" },
      { t: "Workspace Search", d: "Ripgrep ignore walker, regex search, match context and file filter.", u: "/features.html#workspace-search", b: "Search" },
      { t: "Live Preview", d: "Markdown, HTML and SVG live render with synced scroll and split view.", u: "/features.html#live-preview", b: "Preview" },
      { t: "Quick Open & Palette", d: "Fuzzy file search on ⌘P / Ctrl+P, Command Palette on ⌘⇧P / Ctrl+Shift+P.", u: "/features.html#quick-open", b: "Navigation" },
      { t: "Symbol Outline & Git Status", d: "Jump to symbols with ⌘⇧O or @, file status badges and branch tracking.", u: "/features.html#navigation", b: "Navigation" },
      { t: "Performance & Benchmarks", d: "~2.4s startup, ~95 MB RAM, 6.7 MB binary, methodology.", u: "/performance.html", b: "Performance" },
      { t: "Downloads", d: "Download macOS DMG installer or build instructions for Linux and Windows.", u: "/downloads.html", b: "Download" },
      { t: "Documentation Index", d: "Complete documentation: Installation, shortcuts, config, setup.", u: "/docs.html", b: "Docs" },
      { t: "Installation — macOS", d: "Download DMG, drag to Applications, Gatekeeper quarantine fix.", u: "/docs/installation.html#macos", b: "Install" },
      { t: "Installation — Linux", d: "Install WebKitGTK and build dependencies, Rust & Node setup.", u: "/docs/installation.html#linux", b: "Install" },
      { t: "Installation — Windows", d: "WebView2 runtime, Rust and Node prerequisites, NSIS bundle.", u: "/docs/installation.html#windows", b: "Install" },
      { t: "Keyboard Shortcuts", d: "Comprehensive keyboard reference for macOS, Linux and Windows.", u: "/docs/shortcuts.html", b: "Shortcuts" },
      { t: "Configuration & Themes", d: "Fonts (JetBrains Mono, Fira Code), Dark/Light themes, Vim level.", u: "/docs/configuration.html", b: "Config" },
      { t: "Troubleshooting", d: "Gatekeeper macOS, blank window, WebKitGTK Linux, WebView2 Windows.", u: "/docs/troubleshooting.html", b: "Help" },
      { t: "Developer Setup", d: "Build from source, run cargo tests, pnpm dev, pnpm bench.", u: "/docs/development.html", b: "Dev" },
      { t: "Contributing to CMX", d: "Roadmap, issue tracker, commit style, pull requests and code of conduct.", u: "/contributing.html", b: "Community" }
    ];

    var basePath = window.__CMX_BASE__ || '';
    if (basePath) {
      searchItems.forEach(function(item) {
        if (item.u.startsWith('/')) item.u = basePath + item.u;
      });
    }

    var selectedIndex = -1;

    function openSearch() {
      modal.hidden = false;
      input.value = '';
      selectedIndex = -1;
      renderResults('');
      setTimeout(function() { input.focus(); }, 30);
    }

    function closeSearch() {
      modal.hidden = true;
      if (searchBtn) searchBtn.focus();
    }

    function renderResults(q) {
      var query = q.trim().toLowerCase();
      var matched = searchItems.filter(function(item) {
        if (!query) return true;
        return item.t.toLowerCase().includes(query) ||
               item.d.toLowerCase().includes(query) ||
               item.b.toLowerCase().includes(query);
      });

      if (!matched.length) {
        resultsBox.innerHTML = '<div class="search-empty">No results found for "' + escapeHtml(q) + '"</div>';
        return;
      }

      var html = matched.map(function(item, idx) {
        var cls = idx === selectedIndex ? 'search-item selected' : 'search-item';
        return '<a class="' + cls + '" href="' + item.u + '" data-idx="' + idx + '">' +
          '<div class="search-item-title">' +
            '<span>' + escapeHtml(item.t) + '</span>' +
            '<span class="search-item-badge">' + escapeHtml(item.b) + '</span>' +
          '</div>' +
          '<div class="search-item-desc">' + escapeHtml(item.d) + '</div>' +
        '</a>';
      }).join('');

      resultsBox.innerHTML = html;
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', openSearch);
    }

    modal.querySelector('.search-backdrop').addEventListener('click', closeSearch);

    input.addEventListener('input', function() {
      selectedIndex = 0;
      renderResults(input.value);
    });

    input.addEventListener('keydown', function(e) {
      var items = resultsBox.querySelectorAll('.search-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length) {
          selectedIndex = (selectedIndex + 1) % items.length;
          updateSelected(items);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length) {
          selectedIndex = (selectedIndex - 1 + items.length) % items.length;
          updateSelected(items);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items.length && selectedIndex >= 0 && items[selectedIndex]) {
          items[selectedIndex].click();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
      }
    });

    function updateSelected(items) {
      items.forEach(function(item, idx) {
        item.classList.toggle('selected', idx === selectedIndex);
        if (idx === selectedIndex) item.scrollIntoView({ block: 'nearest' });
      });
    }

    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal.hidden) openSearch();
        else closeSearch();
      } else if (e.key === '/' && modal.hidden && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openSearch();
      } else if (e.key === 'Escape' && !modal.hidden) {
        closeSearch();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initTheme();
    initCodeCopy();
    initScrollSpy();
    initMobileNav();
    initSearch();
  }
})();
"""


# ---------------------------------------------------------------------------
# Page content
# ---------------------------------------------------------------------------

def p_hero():
    return f"""
<section class="hero">
  <h1 class="logo">CMX</h1>
  <div class="rule"><i></i><i></i></div>
  <p class="tagline">A lightweight code editor engineered for speed.</p>
  <p class="sub">Powered by Rust and the native OS webview. Real Vim mode,
    lightning-fast workspace search, and split live preview in a clean <b>~7&nbsp;MB</b> package.</p>
  <div class="cta">
    <a class="btn btn-p" href="{LATEST_URL}" rel="noopener">Download for macOS</a>
    <a class="btn btn-s" href="/downloads.html">All platforms</a>
    <a class="btn btn-s" href="{REPO_URL}" rel="noopener">Source on GitHub</a>
  </div>
</section>

<figure class="wide"><a href="{REPO_URL}"><img class="shot"
  src="/screenshots/01-workspace-dark.png" width="1380" height="723" loading="lazy"
  alt="CMX code editor showing a dark-theme workspace with the file explorer open and syntax-highlighted TypeScript."></a></figure>
"""


def p_home():
    body = p_hero() + """
<h2>Why CMX</h2>
<p>Most editors make you choose between lightweight speed and full capability. Electron apps ship
a heavy browser runtime; web editors live in a tab. CMX uses the operating system's own webview,
giving you a lightweight, high performance editor without owning a browser.</p>
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
<p class="lede">Everything CMX does — and, at the end, what it deliberately leaves out.
Figures are on the <a href="/performance.html">performance page</a>.</p>

<h2 id="editing">Editing</h2>
<div class="cards">
  <article class="card">
    <h3>CodeMirror 6 core</h3>
    <p>The mature editing engine, not a reimplementation.</p>
    <ul class="mini">
      <li>Multiple cursors</li>
      <li>Bracket matching and closing</li>
      <li>Code folding</li>
      <li>Search-and-replace panel</li>
      <li>Highlighted selection matches</li>
    </ul>
  </article>
  <article class="card">
    <h3>14 grammars, on demand</h3>
    <p>Language packs load when a file needs them. Opening a Rust file never
    waits on the Python grammar.</p>
    <ul class="tags">
      <li>JS/TS</li><li>Python</li><li>Rust</li><li>C/C++</li><li>Java</li><li>Go</li>
      <li>HTML</li><li>CSS</li><li>JSON</li><li>Markdown</li><li>SQL</li>
      <li>XML</li><li>YAML</li><li>Shell</li><li>Dockerfile</li>
    </ul>
  </article>
  <article class="card">
    <h3>Markdown, properly</h3>
    <p>Headings, emphasis, code, quotes, lists and links — with fenced code blocks
    syntax-highlighted rather than dumped as plain text.</p>
  </article>
  <article class="card">
    <h3>Comfortable defaults</h3>
    <p>The small things you notice after an hour.</p>
    <ul class="mini">
      <li>Tab size 2, 4 or 8</li>
      <li>Word wrap</li>
      <li>Zoom in / out / reset</li>
      <li>Six bundled monospace fonts</li>
    </ul>
  </article>
</div>
<p><a href="/docs/configuration.html">Configuration →</a></p>

<h2 id="large-files">Large files</h2>
<p>Files past <b>1.5&nbsp;MB</b> or <b>25,000 lines</b> drop into fast mode: parsing and
decorative extras switch off so scrolling and editing stay smooth. A
<span class="badge fast">FAST</span> badge in the status bar always tells you which mode
you are in, so it is never a mystery.</p>

<h2 id="vim-mode">Vim mode</h2>
<p>Three levels, switched from the status-bar pill or the command palette.</p>
<div class="cards">
  <article class="card">
    <h3>Off <span class="badge">default</span></h3>
    <p>A plain editor. Nothing is intercepted.</p>
  </article>
  <article class="card">
    <h3>Friendly</h3>
    <p>Hints plus a forgiving Ex command set.</p>
  </article>
  <article class="card">
    <h3>Expert</h3>
    <p>The full motion vocabulary.</p>
  </article>
</div>
<p>Ex commands:</p>
<ul class="exgrid">
  <li>:w<span>save</span></li>
  <li>:q<span>close</span></li>
  <li>:q!<span>close, discard</span></li>
  <li>:wq<span>save and close</span></li>
  <li>:x<span>save and close</span></li>
  <li>:e<span>reload</span></li>
  <li>:noh<span>clear highlight</span></li>
  <li>:bd<span>close buffer</span></li>
  <li>:new<span>new buffer</span></li>
</ul>
<p>A which-key style hint bar appears alongside a mode pill reading
<span class="kbd">NORMAL</span> <span class="kbd">INSERT</span> or
<span class="kbd">VISUAL</span>.</p>

<h2 id="navigation">Navigation</h2>
<div class="cards">
  <article class="card">
    <h3>File explorer</h3>
    <p>Create, rename and delete files and folders inline; reveal in Finder or
    Explorer; open and close a folder.</p>
    <ul class="mini">
      <li>The tree patches itself in place</li>
      <li>Saving a file never collapses the sidebar</li>
    </ul>
  </article>
  <article class="card">
    <h3>Quick Open <span class="kbd">\u2318P</span></h3>
    <p>A ranked file finder over the open workspace, with filename hits ranked
    ahead of directory hits.</p>
    <ul class="mini">
      <li><span class="kbd">\u2318\u21e7P</span> or <span class="kbd">F1</span> \u2014 command palette</li>
      <li><code>:line[,col]</code> \u2014 jump to a position</li>
    </ul>
  </article>
  <article class="card">
    <h3>Workspace search <span class="kbd">\u2318\u21e7F</span></h3>
    <p>Every file in the workspace, grouped by file with two lines of context and
    the matched text highlighted.</p>
    <ul class="mini">
      <li>150&nbsp;ms debounce</li>
      <li>In-flight searches cancel as you keep typing</li>
      <li>Honours <code>.gitignore</code> and skips hidden files</li>
      <li>No external <code>rg</code> binary needed</li>
    </ul>
  </article>
  <article class="card">
    <h3>Tabs</h3>
    <p>Dirty-state dots, per-tab scroll and memory.</p>
    <ul class="mini">
      <li>Close one / right / others / all</li>
      <li>Confirmation before discarding changes</li>
    </ul>
  </article>
</div>

<h2 id="live-preview">Live preview</h2>
<p>Press <span class="kbd">\u2318\u21e7V</span> to render the document beside the source,
split by a resizer you can drag and reset with a double-click.</p>
<div class="cards">
  <article class="card">
    <h3>Markdown</h3>
    <p>Debounced, GitHub-flavored rendering.</p>
  </article>
  <article class="card">
    <h3>HTML</h3>
    <p>Rendered in a sandboxed <code>&lt;iframe&gt;</code>, so the document cannot reach
    the filesystem.</p>
  </article>
  <article class="card">
    <h3>SVG</h3>
    <p>Previewed in place.</p>
  </article>
</div>

<h2 id="status-bar">Status bar</h2>
<p>Vim mode pill, detected language, <code>Ln</code>/<code>Col</code> that jumps to Go to
Line and reports the document's total line count, selection size, word-wrap state,
encoding, and loading and fast-mode indicators.</p>

<h2 id="not-doing">What CMX does not do</h2>
<div class="cards">
  <article class="card">
    <h3>No native-code plugins</h3>
    <p>CMX renders in the OS webview. Plugins that run arbitrary native code
    would undercut the reason it ships no browser runtime.</p>
  </article>
  <article class="card">
    <h3>No terminal multiplexer</h3>
    <p>tmux and the terminal already do this better.</p>
  </article>
  <article class="card">
    <h3>No cloud sync</h3>
    <p>Settings are a small file. Put it in your dotfiles repository.</p>
  </article>
</div>
<p>The <a href="/contributing.html#roadmap">roadmap</a> records what is being considered
and why.</p>
"""
    return page(
        path="/features.html",
        title=f"Features \u2014 {NAME} code editor for macOS, Linux and Windows",
        description="Vim mode with three levels, .gitignore-aware workspace search, Quick "
                    "Open, large-file fast mode, and live preview for Markdown, HTML and SVG.",
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
<tr><td><code>⌘⇧O</code></td><td><code>Ctrl+Shift+O</code></td><td>Go to symbol in active file (or type <code>@</code> in Quick Open)</td></tr>
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
    global BASE_PATH
    parser = argparse.ArgumentParser(description="Generate the CMX static website into docs/.")
    parser.add_argument("--base", default=None, help="Override base path (e.g. '' for root or '/cmx')")
    parser.add_argument("--serve", nargs="?", const=8000, type=int, default=None,
                        help="Start a local preview server (default port: 8000)")
    args, _ = parser.parse_known_args()
    if args.base is not None:
        BASE_PATH = args.base.rstrip("/")

    assets = OUT / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "site.css").write_text(CSS, encoding="utf-8")
    (assets / "site.js").write_text(JS, encoding="utf-8")

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
    print(f"\n  sitemap.xml, robots.txt, .nojekyll, assets/site.css, assets/site.js written to {OUT.relative_to(ROOT)}/")

    if args.serve is not None:
        import http.server
        import socketserver
        port = args.serve

        class CmxPreviewHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *a, **kw):
                super().__init__(*a, directory=str(OUT), **kw)

            def translate_path(self, path):
                if path == "/":
                    if BASE_PATH:
                        self.send_response(302)
                        self.send_header("Location", f"{BASE_PATH}/")
                        self.end_headers()
                        return ""
                if BASE_PATH and path.startswith(f"{BASE_PATH}/"):
                    path = "/" + path[len(BASE_PATH) + 1:]
                elif BASE_PATH and path == BASE_PATH:
                    self.send_response(302)
                    self.send_header("Location", f"{BASE_PATH}/")
                    self.end_headers()
                    return ""
                return super().translate_path(path)

        url = f"http://localhost:{port}{BASE_PATH}/" if BASE_PATH else f"http://localhost:{port}/"
        print(f"\n  Local preview running at {url}")
        print("  Press Ctrl+C to stop.\n")
        socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer(("", port), CmxPreviewHandler) as httpd:
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n  Stopped preview server.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())