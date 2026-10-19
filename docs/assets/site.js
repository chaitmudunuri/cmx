
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
      { t: "Home", d: "A lightweight, high performance code editor with Vim mode, search and live preview.", u: "/index.html", b: "Page" },
      { t: "Features Overview", d: "CodeMirror 6 core, multiple cursors, fast mode, syntax highlight, themes.", u: "/features.html", b: "Features" },
      { t: "Vim Mode", d: "Three levels: Off, Friendly, Expert. Ex command bar (:w, :q, :s, :noh).", u: "/features.html#vim-mode", b: "Vim" },
      { t: "Workspace Search", d: "Ripgrep ignore walker, regex search, match context and file filter.", u: "/features.html#workspace-search", b: "Search" },
      { t: "Live Preview", d: "Markdown, HTML and SVG live render with synced scroll and split view.", u: "/features.html#live-preview", b: "Preview" },
      { t: "Quick Open & Palette", d: "Fuzzy file search on ⌘P / Ctrl+P, Command Palette on ⌘⇧P / Ctrl+Shift+P.", u: "/features.html#quick-open", b: "Navigation" },
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
