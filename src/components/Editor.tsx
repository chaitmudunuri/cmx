import { batch, createEffect, createMemo, on, onCleanup, onMount, Show } from "solid-js";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, selectAll } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, search, openSearchPanel, highlightSelectionMatches } from "@codemirror/search";
import { tags } from "@lezer/highlight";
import {
  bracketMatching,
  foldGutter,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
  HighlightStyle,
  StreamLanguage,
  Language,
  LanguageSupport,
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { vim, Vim, getCM } from "@replit/codemirror-vim";
import { invoke } from "@tauri-apps/api/core";
import { editorStore, isBinaryImageFile, type OpenFile } from "../stores/editor";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import ImageViewer from "./ImageViewer";

// ============================================
// cmx Zed-Inspired High-Aesthetic Themes
// ============================================

const darkTheme = EditorView.theme(
  {
    "&": { color: "#e4e4e7", backgroundColor: "#18181b", height: "100%" },
    ".cm-content": {
      caretColor: "#0969da",
      fontFamily: "var(--editor-font-family, 'JetBrains Mono Variable', monospace)",
      fontSize: "var(--editor-font-size, 13.5px)",
      lineHeight: "1.6",
      padding: "8px 0",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#0969da", borderWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(9, 105, 218, 0.32) !important",
    },
    ".cm-panels": { backgroundColor: "#1f1f23", color: "#f4f4f5" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid #27272a" },
    ".cm-panels.cm-panels-bottom": { borderTop: "1px solid #27272a" },
    ".cm-searchMatch": {
      backgroundColor: "rgba(251, 191, 36, 0.28)",
      outline: "1px solid rgba(251, 191, 36, 0.6)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(9, 105, 218, 0.45)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.035)" },
    ".cm-selectionMatch": { backgroundColor: "rgba(255, 255, 255, 0.08)" },
    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "rgba(255, 255, 255, 0.12)",
      outline: "1px solid #0969da",
    },
    ".cm-gutters": {
      backgroundColor: "#18181b",
      color: "#52525b",
      borderRight: "1px solid #27272a",
      paddingRight: "6px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#a1a1aa",
      fontWeight: "600",
    },
    ".cm-foldPlaceholder": { backgroundColor: "#27272a", border: "none", color: "#a1a1aa", borderRadius: "3px", padding: "0 4px" },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
    },
  },
  { dark: true }
);

const darkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#c084fc", fontWeight: "550" }, // purple/violet
  { tag: [tags.controlKeyword, tags.moduleKeyword], color: "#f472b6" }, // rose/pink
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#0969da" }, // GitHub blue
  { tag: [tags.typeName, tags.className, tags.namespace], color: "#fbbf24" }, // amber
  { tag: [tags.string, tags.special(tags.string), tags.character], color: "#4ade80" }, // emerald green
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "#fb923c" }, // orange
  { tag: [tags.meta, tags.comment, tags.lineComment, tags.blockComment], color: "#71717a", fontStyle: "italic" },
  { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: "#0969da" }, // GitHub blue
  { tag: tags.variableName, color: "#e4e4e7" },
  { tag: tags.tagName, color: "#f472b6" },
  { tag: tags.attributeName, color: "#0969da" },
  { tag: [tags.operator, tags.punctuation], color: "#a1a1aa" },
  { tag: tags.regexp, color: "#34d399" },
  { tag: tags.escape, color: "#fbbf24" },
  { tag: tags.heading, fontWeight: "bold", color: "#c084fc" },
  { tag: tags.link, color: "#0969da", textDecoration: "underline" },
  { tag: tags.url, color: "#0969da", textDecoration: "underline" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#e4e4e7" },
  { tag: tags.strong, fontWeight: "bold", color: "#fafafa" },
  { tag: tags.strikethrough, color: "#a1a1aa", textDecoration: "line-through" },
  { tag: tags.monospace, color: "#4ade80", backgroundColor: "rgba(74, 222, 128, 0.1)" },
  { tag: tags.quote, color: "#a1a1aa", fontStyle: "italic" },
  { tag: tags.list, color: "#0969da" },
  { tag: tags.contentSeparator, color: "#52525b" },
  { tag: tags.meta, color: "#71717a" },
  { tag: tags.invalid, color: "#f87171" },
]);

const lightTheme = EditorView.theme(
  {
    "&": { color: "#1f2328", backgroundColor: "#ffffff", height: "100%" },
    ".cm-content": {
      caretColor: "#0969da",
      fontFamily: "var(--editor-font-family, 'JetBrains Mono Variable', monospace)",
      fontSize: "var(--editor-font-size, 13.5px)",
      lineHeight: "1.6",
      padding: "8px 0",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#0969da", borderWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(9, 105, 218, 0.15) !important",
    },
    ".cm-panels": { backgroundColor: "#f6f8fa", color: "#1f2328" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid #d0d7de" },
    ".cm-panels.cm-panels-bottom": { borderTop: "1px solid #d0d7de" },
    ".cm-searchMatch": {
      backgroundColor: "rgba(255, 211, 61, 0.4)",
      outline: "1px solid rgba(255, 211, 61, 0.7)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(9, 105, 218, 0.28)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(234, 238, 242, 0.55)" },
    ".cm-selectionMatch": { backgroundColor: "rgba(9, 105, 218, 0.08)" },
    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "rgba(9, 105, 218, 0.12)",
      outline: "1px solid #0969da",
    },
    ".cm-gutters": {
      backgroundColor: "#f6f8fa",
      color: "#8c959f",
      borderRight: "1px solid #d0d7de",
      paddingRight: "6px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#1f2328",
      fontWeight: "600",
    },
    ".cm-foldPlaceholder": { backgroundColor: "#eaeef2", border: "none", color: "#656d76", borderRadius: "3px", padding: "0 4px" },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
    },
  },
  { dark: false }
);

const lightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#cf222e", fontWeight: "550" }, // GitHub red
  { tag: [tags.controlKeyword, tags.moduleKeyword], color: "#cf222e" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#8250df" }, // GitHub purple
  { tag: [tags.typeName, tags.className, tags.namespace], color: "#953800" }, // amber
  { tag: [tags.string, tags.special(tags.string), tags.character], color: "#0a3069" }, // navy blue / dark green
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "#0550ae" }, // blue
  { tag: [tags.meta, tags.comment, tags.lineComment, tags.blockComment], color: "#6e7781", fontStyle: "italic" },
  { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: "#116329" }, // green property keys
  { tag: tags.variableName, color: "#1f2328" },
  { tag: tags.tagName, color: "#116329" },
  { tag: tags.attributeName, color: "#0550ae" },
  { tag: [tags.operator, tags.punctuation], color: "#24292f" },
  { tag: tags.regexp, color: "#116329" },
  { tag: tags.escape, color: "#953800" },
  { tag: tags.heading, fontWeight: "bold", color: "#8250df" },
  { tag: tags.link, color: "#0969da", textDecoration: "underline" },
  { tag: tags.url, color: "#0969da", textDecoration: "underline" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#1f2328" },
  { tag: tags.strong, fontWeight: "bold", color: "#1f2328" },
  { tag: tags.strikethrough, color: "#6e7781", textDecoration: "line-through" },
  { tag: tags.monospace, color: "#116329", backgroundColor: "rgba(17, 99, 51, 0.08)" },
  { tag: tags.quote, color: "#6e7781", fontStyle: "italic" },
  { tag: tags.list, color: "#0969da" },
  { tag: tags.contentSeparator, color: "#d0d7de" },
  { tag: tags.meta, color: "#6e7781" },
  { tag: tags.invalid, color: "#cf222e" },
]);

function themeExtensions(mode: "dark" | "light") {
  return mode === "dark"
    ? [darkTheme, syntaxHighlighting(darkHighlight)]
    : [lightTheme, syntaxHighlighting(lightHighlight)];
}

// ---- Lazy language packs ----
// The 14 language packages ship as separate async chunks and load on first
// use, keeping them out of the initial bundle. States are created instantly
// with an empty language compartment; ensureLanguageFor() fills it in when
// the chunk arrives (and records the Language for markdown code fences).

const langLoaders: Record<string, () => Promise<Extension>> = {
  javascript: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ jsx: true, typescript: true })
    ),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  markdown: () =>
    import("@codemirror/lang-markdown").then((m) =>
      m.markdown({ codeLanguages: lookupLoadedCodeLanguage })
    ),
  rust: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  xml: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  dockerfile: () =>
    import("@codemirror/legacy-modes/mode/dockerfile").then((m) =>
      StreamLanguage.define(m.dockerFile)
    ),
  shell: () =>
    import("@codemirror/legacy-modes/mode/shell").then((m) =>
      StreamLanguage.define(m.shell)
    ),
};

const langPromises = new Map<string, Promise<Extension | null>>();
const loadedCodeLanguages: Language[] = [];

const CODE_LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "javascript",
  tsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  yml: "yaml",
  htm: "html",
  md: "markdown",
  "c++": "cpp",
  h: "cpp",
  hpp: "cpp",
};

/** Code-fence language lookup for markdown; consulted at parse time, so
 *  fences light up as each language chunk finishes loading. */
function lookupLoadedCodeLanguage(info: string): Language | null {
  const q = info.trim().toLowerCase();
  if (!q) return null;
  const name = CODE_LANG_ALIASES[q] ?? q;
  return loadedCodeLanguages.find((l) => l.name.toLowerCase() === name) ?? null;
}

function registerCodeLanguage(ext: Extension) {
  const lang = ext instanceof LanguageSupport ? ext.language : (ext as Language);
  if (lang instanceof Language && !loadedCodeLanguages.some((l) => l.name === lang.name)) {
    loadedCodeLanguages.push(lang);
  }
}

function loadLanguage(lang: string): Promise<Extension | null> {
  if (!lang) return Promise.resolve(null);
  const cached = langPromises.get(lang);
  if (cached) return cached;
  const loader = langLoaders[lang];
  if (!loader) {
    const none = Promise.resolve(null);
    langPromises.set(lang, none);
    return none;
  }
  const p: Promise<Extension | null> = loader().then(
    (ext) => {
      registerCodeLanguage(ext);
      return ext;
    },
    (err) => {
      console.warn(`Language '${lang}' failed to load:`, err);
      langPromises.delete(lang);
      return null;
    }
  );
  langPromises.set(lang, p);
  return p;
}

export default function Editor() {
  const {
    activeFile,
    activeFilePath,
    updateFileContent,
    markFileSaved,
    theme,
    openFile: storeOpenFile,
    openSearch,
    pendingLineJump,
    setPendingLineJump,
    openContextMenu,
    revealItem,
    canPreview,
    isPreviewOpen,
    togglePreview,
    rootPath,
    loadFolder,
    upsertTreeNode,
    parentDirOf,
    newUntitledFile,
    openFontModal,
    toggleTheme,
    closeFile,
    closeActiveFile,
    setCursorPosition,
    setDocLineCount,
    markFileModified,
    setLoadingFilePath,
    isVimMode,
    setVimModeStatus,
    isWordWrap,
    toggleWordWrap,
    tabSize,
    openGoToLine,
    registerSaveHandler,
    registerActiveEditorView,
    openFiles,
  } = editorStore;

  let view: EditorView | undefined;
  let visiblePath: string | null = null;
  const docStates = new Map<string, EditorState>();
  const docScroll = new Map<string, { top: number; left: number }>();

  const themeCompartment = new Compartment();
  const vimCompartment = new Compartment();
  const wrapCompartment = new Compartment();
  const langCompartment = new Compartment();
  const tabCompartment = new Compartment();

  let previewTimer: ReturnType<typeof setTimeout> | undefined;

  // ---- State construction: one state per document, listener owns its path ----

  function makeState(file: OpenFile): EditorState {
    const path = file.path;
    // Trust the store's single classification (classifyDoc at open/restore);
    // re-scanning here would redo the 25k-line split on every tab switch.
    const large = !!file.isLarge;

    const shared = [
      themeCompartment.of(themeExtensions(theme())),
      vimCompartment.of(isVimMode() ? vim() : []),
      wrapCompartment.of(isWordWrap() ? EditorView.lineWrapping : []),
      tabCompartment.of(indentUnit.of(" ".repeat(tabSize()))),
      // Language support arrives async (see ensureLanguageFor); the state
      // is fully usable for editing in the meantime.
      langCompartment.of([]),
      history(),
      search({ top: true }),
      lineNumbers(),
      highlightSpecialChars(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      EditorState.allowMultipleSelections.of(true),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      indentOnInput(),
      keymap.of([
        { key: "Mod-s", run: () => (saveCurrentFile(), true) },
        { key: "Mod-o", run: () => (openFileDialog(), true) },
        { key: "Mod-p", run: () => (openSearch("files"), true) },
        { key: "Mod-Shift-f", run: () => (openSearch("grep"), true) },
        { key: "Mod-Shift-p", run: () => (openSearch("commands"), true) },
        { key: "Mod-Shift-o", run: () => (openSearch("symbols"), true) },
        { key: "Mod-g", run: () => (openGoToLine(), true) },
        { key: "Alt-z", run: () => (toggleWordWrap(), true) },
        // ⌘W is owned by the native menu (main.rs accelerator -> "close-active-tab")
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        // One batch per keystroke: dirty flag + cursor + line count propagate
        // to subscribers together instead of in three separate rounds.
        batch(() => {
          if (update.docChanged) {
            markFileModified(path, true);
            if (!large && isPreviewOpen() && canPreview()) {
              clearTimeout(previewTimer);
              previewTimer = setTimeout(() => {
                if (visiblePath === path && view) {
                  updateFileContent(path, view.state.doc.toString());
                }
              }, 250);
            }
          }
          if ((update.selectionSet || update.docChanged) && visiblePath === path) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            setCursorPosition({
              line: line.number,
              col: head - line.from + 1,
              selected: Math.abs(
                update.state.selection.main.to - update.state.selection.main.from
              ),
            });
            setDocLineCount(update.state.doc.lines);
          }
        });
      }),
    ];

    if (large) {
      // Fast mode: no parsing, folding, bracket or match highlighting
      return EditorState.create({ doc: file.content, extensions: shared });
    }

    return EditorState.create({
      doc: file.content,
      extensions: [
        ...shared,
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        foldGutter(),
      ],
    });
  }

  /** Fill in a tab's language support once its chunk loads. Applies to the
   *  live view if still visible, and refreshes the cached state copy.
   *  Skips tabs whose current state already carries this language. */
  const appliedLangs = new Map<string, string>();
  async function ensureLanguageFor(path: string, lang: string) {
    if (!lang || appliedLangs.get(path) === lang) return;
    const ext = await loadLanguage(lang);
    if (!ext) return;
    const eff = langCompartment.reconfigure(ext);
    if (visiblePath === path && view) view.dispatch({ effects: eff });
    const cached = docStates.get(path);
    if (cached) docStates.set(path, cached.update({ effects: eff }).state);
    appliedLangs.set(path, lang);
  }

  // ---- View lifecycle ----

  function flushVisible() {
    if (!view || !visiblePath) return;
    // Remember where this document was scrolled (shared view = shared DOM scroller)
    docScroll.set(visiblePath, {
      top: view.scrollDOM.scrollTop,
      left: view.scrollDOM.scrollLeft,
    });
    // Keep cached state + store content in sync with what the user typed.
    // The full-string copy runs only for dirty files; clean tabs switch
    // with zero allocation or store churn.
    docStates.set(visiblePath, view.state);
    if (
      editorStore.isFileOpen(visiblePath) &&
      editorStore.isModified(visiblePath)
    ) {
      updateFileContent(visiblePath, view.state.doc.toString());
    }
  }

  function showFile(path: string) {
    const file = openFiles.find((f) => f.path === path);
    if (!file || !view) return;

    let state = docStates.get(path);
    if (!state) {
      state = makeState(file);
      docStates.set(path, state);
      // Fresh state starts without language support; clear any stale marker
      // so ensureLanguageFor() below fills it in when the chunk arrives.
      appliedLangs.delete(path);
    }
    // Reuse the single shared view: swapping state is O(1) vs full
    // DOM teardown + extension re-init on every tab switch. Vim state
    // lives in a StateField inside each EditorState, so modes stay
    // isolated per tab without recreating the view.
    if (state !== view.state) {
      view.setState(state);
    }
    visiblePath = path;
    setDocLineCount(view.state.doc.lines);
    void ensureLanguageFor(path, file.language);

    const scroll = docScroll.get(path);
    if (scroll) {
      view.scrollDOM.scrollTop = scroll.top;
      view.scrollDOM.scrollLeft = scroll.left;
    }

    if (isVimMode()) attachVimListener();
    view.focus();
    handlePendingJump();
  }

  function switchTo(path: string | null) {
    if (!view) return;
    if (path === visiblePath) return;
    flushVisible();

    if (!path) {
      visiblePath = null;
      view.setState(EditorState.create({ doc: "" }));
      return;
    }
    showFile(path);
  }

  function ensureView(el: HTMLElement) {
    if (view) {
      if (!el.contains(view.dom)) el.appendChild(view.dom);
      return;
    }
    view = new EditorView({ parent: el });
    registerActiveEditorView(view);
    attachVimListener();
    switchTo(activeFilePath());
  }

  function attachVimListener() {
    if (!view) return;
    const cm = getCM(view) as any;
    if (cm && !cm._cmxModeListener) {
      cm._cmxModeListener = true;
      cm.on("vim-mode-change", (e: any) => {
        let mode = (e?.mode || "normal").toUpperCase();
        if (e?.subMode === "linewise") mode = "V-LINE";
        else if (e?.subMode === "blockwise") mode = "V-BLOCK";
        setVimModeStatus(mode);
      });
    }
  }

  function handlePendingJump() {
    const jump = pendingLineJump();
    if (!jump || !view) return;
    try {
      const lineNum = typeof jump === "number" ? jump : jump.line;
      const col = typeof jump === "number" ? 1 : jump.col ?? 1;
      const doc = view.state.doc;
      const line = doc.line(Math.min(Math.max(1, lineNum), doc.lines));
      const pos = Math.min(line.from + Math.max(0, col - 1), line.to);
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    } catch (err) {
      console.error("Jump error:", err);
    } finally {
      setPendingLineJump(null);
    }
  }

  // ---- Save / open ----

  async function saveCurrentFile(): Promise<boolean> {
    if (!view) return false;
    flushVisible();
    const file = activeFile();
    if (!file) return false;

    let targetPath = file.path;
    if (targetPath.startsWith("untitled://")) {
      const selected = await save({ defaultPath: file.name });
      if (!selected || typeof selected !== "string") return false;
      targetPath = selected;
    }

    try {
      const content = view.state.doc.toString();
      await invoke("write_file", { path: targetPath, content });
      if (targetPath !== file.path) {
        const name = targetPath.split(/[\\/]/).pop() ?? targetPath;
        docStates.delete(file.path);
        closeFile(file.path, true);
        storeOpenFile(targetPath, name, content);
        // Save-as created a new file on disk: patch it into the tree
        // instead of reloading the whole folder.
        const root = rootPath();
        if (root && (targetPath === root || targetPath.startsWith(root + "/") || targetPath.startsWith(root + "\\"))) {
          upsertTreeNode(parentDirOf(targetPath) || root, {
            name,
            path: targetPath,
            isDir: false,
          });
        }
      }
      updateFileContent(targetPath, content);
      markFileSaved(targetPath);
      return true;
    } catch (e) {
      console.error("Failed to save:", e);
      return false;
    }
  }

  async function openFileDialog() {
    const selected = await open({ multiple: false, directory: false });
    if (selected && typeof selected === "string") {
      const name = selected.split(/[\\/]/).pop() ?? selected;
      if (isBinaryImageFile(name)) {
        storeOpenFile(selected, name, "");
        return;
      }
      try {
        setLoadingFilePath(selected);
        const content = await invoke<string>("read_file", { path: selected });
        storeOpenFile(selected, name, content);
      } catch (e) {
        console.error("Failed to open file:", e);
      } finally {
        setLoadingFilePath(null);
      }
    }
  }

  async function openFolderDialog() {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      await loadFolder(selected);
    }
  }

  // ---- Effects ----

  onMount(() => {
    registerSaveHandler(saveCurrentFile);

    const defineEx = (name: string, shortcut: string, fn: (...args: any[]) => void) => {
      try {
        Vim.defineEx(name, shortcut, fn);
      } catch (err) {
        console.warn(`Vim :${name} not registered:`, err);
      }
    };

    defineEx("write", "w", () => void saveCurrentFile());
    defineEx("quit", "q", () => setTimeout(() => closeActiveFile(false), 0));
    defineEx("quit!", "quit", () => setTimeout(() => closeActiveFile(true), 0));
    defineEx("q!", "q", () => setTimeout(() => closeActiveFile(true), 0));
    defineEx("bdelete", "bd", () => setTimeout(() => closeActiveFile(false), 0));
    defineEx("close", "clo", () => setTimeout(() => closeActiveFile(false), 0));
    defineEx("exit", "exi", () => setTimeout(() => closeActiveFile(false), 0));
    defineEx("wq", "wq", async () => {
      await saveCurrentFile();
      setTimeout(() => closeActiveFile(true), 0);
    });
    defineEx("x", "x", async () => {
      await saveCurrentFile();
      setTimeout(() => closeActiveFile(true), 0);
    });
    defineEx("new", "new", () => newUntitledFile());

    // Warm the language chunks for already-open tabs while idle, so
    // switching to a background tab rarely waits on a network chunk.
    setTimeout(() => {
      const langs = new Set(openFiles.map((f) => f.language).filter(Boolean));
      for (const lang of langs) void loadLanguage(lang);
    }, 1500);

    const unlisteners = Promise.all([
      listen("menu-new-file", () => newUntitledFile()),
      listen("menu-open-file", () => openFileDialog()),
      listen("menu-save-file", () => saveCurrentFile()),
    ]);
    onCleanup(() => void unlisteners.then((fns) => fns.forEach((fn) => fn())));
  });

  onCleanup(() => {
    registerActiveEditorView(null);
    view?.destroy();
    view = undefined;
  });

  createEffect(on(activeFilePath, (path) => switchTo(path)));

  // Drop cached states for closed files (content already flushed on switch/close)
  createEffect(() => {
    const open = new Set(openFiles.map((f) => f.path));
    for (const cached of docStates.keys()) {
      if (!open.has(cached)) docStates.delete(cached);
    }
    for (const cached of docScroll.keys()) {
      if (!open.has(cached)) docScroll.delete(cached);
    }
    for (const cached of [...appliedLangs.keys()]) {
      if (!open.has(cached)) appliedLangs.delete(cached);
    }
  });

  // Reconfigure visible state when global settings toggle
  const reconfigure = (effect: () => any) => {
    const eff = effect();
    if (view && visiblePath) view.dispatch({ effects: eff });
    // Also apply to background tabs so they don't revert to old themes
    for (const [path, state] of docStates.entries()) {
      if (path !== visiblePath) {
        docStates.set(path, state.update({ effects: eff }).state);
      }
    }
  };
  createEffect(() => {
    const mode = theme();
    reconfigure(() => themeCompartment.reconfigure(themeExtensions(mode)));
  });
  createEffect(() => {
    const enabled = isVimMode();
    reconfigure(() => vimCompartment.reconfigure(enabled ? vim() : []));
    if (enabled) {
      setVimModeStatus("NORMAL");
      attachVimListener();
    }
  });
  createEffect(() => {
    const wrap = isWordWrap();
    reconfigure(() => wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []));
  });
  createEffect(() => {
    const n = tabSize();
    reconfigure(() => tabCompartment.reconfigure(indentUnit.of(" ".repeat(n))));
  });
  createEffect(() => {
    if (pendingLineJump()) handlePendingJump();
  });

  // ---- Context menu ----

  function handleContextMenu(e: MouseEvent) {
    if ((e.target as HTMLElement)?.closest(".cm-panel")) return;
    e.preventDefault();
    e.stopPropagation();

    const file = activeFile();
    if (!file || !view) return;

    const hasSelection = !view.state.selection.main.empty;
    const selectedText = hasSelection
      ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
      : "";

    openContextMenu(e.clientX, e.clientY, [
      {
        label: "Cut",
        icon: "codicon-cut",
        shortcut: "⌘X",
        disabled: !hasSelection,
        action: async () => {
          if (!hasSelection || !view) return;
          await navigator.clipboard.writeText(selectedText);
          view.dispatch(view.state.replaceSelection(""));
          view.focus();
        },
      },
      {
        label: "Copy",
        icon: "codicon-copy",
        shortcut: "⌘C",
        disabled: !hasSelection,
        action: () => hasSelection && navigator.clipboard.writeText(selectedText),
      },
      {
        label: "Paste",
        icon: "codicon-paste",
        shortcut: "⌘V",
        action: async () => {
          try {
            const text = await navigator.clipboard.readText();
            if (text && view) {
              view.dispatch(view.state.replaceSelection(text));
              view.focus();
            }
          } catch (err) {
            console.error("Paste error:", err);
          }
        },
      },
      { separator: true },
      {
        label: "Find...",
        icon: "codicon-search",
        shortcut: "⌘F",
        action: () => view && openSearchPanel(view),
      },
      {
        label: "Replace...",
        icon: "codicon-replace",
        shortcut: "⌥⌘F",
        action: () => view && openSearchPanel(view),
      },
      { separator: true },
      ...(canPreview()
        ? [
            {
              label: isPreviewOpen() ? "Close Preview" : "Open Live Preview",
              icon: "codicon-preview",
              shortcut: "⌘⇧V",
              action: () => togglePreview(),
            },
            { separator: true },
          ]
        : []),
      {
        label: "Select All",
        shortcut: "⌘A",
        action: () => {
          if (view) {
            selectAll(view);
            view.focus();
          }
        },
      },
      { separator: true },
      {
        label: "Copy Path",
        icon: "codicon-copy",
        action: () => navigator.clipboard.writeText(file.path),
      },
      ...(!file.path.startsWith("untitled://")
        ? [
            {
              label: "Reveal in Finder",
              icon: "codicon-folder-opened",
              action: () => revealItem(file.path),
            },
          ]
        : []),
    ]);
  }

  const isCurrentImage = createMemo(() => {
    const file = activeFile();
    return file ? isBinaryImageFile(file.name) : false;
  });

  // ---- Render ----

  return (
    <Show
      when={activeFilePath()}
      fallback={
        <div class="welcome">
          <div class="welcome-container">
            <div class="welcome-header">
              <div class="welcome-mark-svg">
                <svg width="48" height="48" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="purpleBrandGrad" x1="100" y1="100" x2="924" y2="924" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stop-color="#a78bfa" />
                      <stop offset="100%" stop-color="#6d28d9" />
                    </linearGradient>
                  </defs>
                  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#purpleBrandGrad)" />
                  <path d="M360 375L495 512L360 649" stroke="#ffffff" stroke-width="68" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M545 649H680" stroke="#ffffff" stroke-width="68" stroke-linecap="round"/>
                </svg>
              </div>
              <h1 class="welcome-title">cmx editor</h1>
              <p class="welcome-description">
                Sub-10MB fast desktop code editor with Vim mode, instant ripgrep search, and live preview.
              </p>
              <Show when={rootPath()}>
                <p class="welcome-subtitle">
                  <span class="welcome-workspace-label">
                    <i class="codicon codicon-folder" />
                    <span>{rootPath()?.split("/").pop() ?? rootPath()}</span>
                  </span>
                </p>
              </Show>
            </div>

            <div class="welcome-actions">
              <button class="welcome-action-row" onClick={() => openSearch("files")}>
                <span class="welcome-action-label">
                  <i class="codicon codicon-go-to-file" />
                  <span>Quick Open</span>
                </span>
                <kbd class="welcome-kbd">⌘P</kbd>
              </button>

              <button class="welcome-action-row" onClick={() => openSearch("commands")}>
                <span class="welcome-action-label">
                  <i class="codicon codicon-terminal" />
                  <span>Command Palette</span>
                </span>
                <kbd class="welcome-kbd">⌘⇧P</kbd>
              </button>

              <button class="welcome-action-row" onClick={newUntitledFile}>
                <span class="welcome-action-label">
                  <i class="codicon codicon-new-file" />
                  <span>New File</span>
                </span>
                <kbd class="welcome-kbd">⌘N</kbd>
              </button>

              <button class="welcome-action-row" onClick={openFileDialog}>
                <span class="welcome-action-label">
                  <i class="codicon codicon-file" />
                  <span>Open File...</span>
                </span>
                <kbd class="welcome-kbd">⌘O</kbd>
              </button>

              <button class="welcome-action-row" onClick={openFolderDialog}>
                <span class="welcome-action-label">
                  <i class="codicon codicon-folder-opened" />
                  <span>Open Folder...</span>
                </span>
              </button>

              <button class="welcome-action-row" onClick={() => openSearch("grep")}>
                <span class="welcome-action-label">
                  <i class="codicon codicon-search" />
                  <span>Search in Project</span>
                </span>
                <kbd class="welcome-kbd">⌘⇧F</kbd>
              </button>
            </div>
          </div>
        </div>
      }
    >
      <Show
        when={!isCurrentImage()}
        fallback={<ImageViewer file={activeFile()!} />}
      >
        <div
          ref={ensureView}
          class="editor-container"
          onContextMenu={handleContextMenu}
        />
      </Show>
    </Show>
  );
}
