import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { editorStore } from "../stores/editor";
import { getFileIcon } from "./FileIcon";

interface GrepMatch {
  path: string;
  rel_path: string;
  line_number: number;
  line_text: string;
  context_before: string[];
  context_after: string[];
}

interface FileGroup {
  path: string;
  rel_path: string;
  name: string;
  matches: GrepMatch[];
  expanded: boolean;
}

export default function SidebarSearch() {
  const {
    rootPath,
    openFile,
    setLoadingFilePath,
    initialGrepQuery,
    setInitialGrepQuery,
  } = editorStore;

  const [query, setQuery] = createSignal("");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [groups, setGroups] = createSignal<FileGroup[]>([]);
  const [totalMatches, setTotalMatches] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let debounceTimer: any = null;
  let grepSeq = 0;

  onMount(() => {
    inputRef?.focus();
    inputRef?.select();
  });

  // React to external initialGrepQuery (e.g. from Cmd+Shift+F or QuickOpen)
  createEffect(() => {
    const init = initialGrepQuery();
    if (init) {
      setQuery(init);
      setInitialGrepQuery("");
      setTimeout(() => {
        inputRef?.focus();
        runSearch(init);
      }, 30);
    }
  });

  function onInput(e: InputEvent) {
    const val = (e.target as HTMLInputElement).value;
    setQuery(val);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runSearch(val);
    }, 150);
  }

  async function runSearch(q: string) {
    const root = rootPath();
    const trimmed = q.trim();
    if (!root || !trimmed) {
      setGroups([]);
      setTotalMatches(0);
      setIsLoading(false);
      return;
    }

    // Monotonic id: only the latest keystroke's results render; older
    // walks are aborted backend-side and dropped here if they still land.
    const seq = ++grepSeq;
    setIsLoading(true);
    try {
      const results = await invoke<GrepMatch[]>("live_grep", {
        root,
        query: trimmed,
        caseSensitive: caseSensitive(),
        limit: 150,
      });
      if (seq !== grepSeq) return;

      // Group results by file path
      const map = new Map<string, FileGroup>();
      for (const m of results) {
        let group = map.get(m.path);
        if (!group) {
          const name = m.path.split("/").pop() ?? m.path.split("\\").pop() ?? m.path;
          group = {
            path: m.path,
            rel_path: m.rel_path,
            name,
            matches: [],
            expanded: true,
          };
          map.set(m.path, group);
        }
        group.matches.push(m);
      }

      setGroups(Array.from(map.values()));
      setTotalMatches(results.length);
    } catch (err) {
      if (seq !== grepSeq) return;
      console.error("Search error:", err);
      setGroups([]);
      setTotalMatches(0);
    } finally {
      if (seq === grepSeq) setIsLoading(false);
    }
  }

  function toggleGroup(path: string) {
    setGroups((prev) =>
      prev.map((g) => (g.path === path ? { ...g, expanded: !g.expanded } : g))
    );
  }

  function toggleCollapseAll() {
    const anyExpanded = groups().some((g) => g.expanded);
    setGroups((prev) => prev.map((g) => ({ ...g, expanded: !anyExpanded })));
  }

  function clearSearch() {
    setQuery("");
    setGroups([]);
    setTotalMatches(0);
    inputRef?.focus();
  }

  async function handleMatchClick(path: string, name: string, line: number) {
    try {
      setLoadingFilePath(path);
      const content = await invoke<string>("read_file", { path });
      openFile(path, name, content, line);
    } catch (e) {
      console.error("Failed to open search match:", e);
    } finally {
      setLoadingFilePath(null);
    }
  }

  function highlightMatch(text: string, q: string) {
    if (!q) return <span>{text}</span>;
    const isCase = caseSensitive();
    const flags = isCase ? "g" : "gi";
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, flags);
    // With a capture group, split() interleaves matches at odd indices —
    // no per-part regex.test(), which would misbehave with a /g/ flag
    // (stateful lastIndex across calls).
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <span class="search-match-text">{part}</span>
          ) : (
            <span>{part}</span>
          )
        )}
      </span>
    );
  }

  onCleanup(() => {
    clearTimeout(debounceTimer);
  });

  return (
    <div class="sidebar-search">
      {/* Header Bar */}
      <div class="sidebar-section-header">
        <span class="sidebar-section-title">SEARCH</span>
        <div class="sidebar-actions">
          <button
            onClick={() => runSearch(query())}
            title="Refresh Search"
            disabled={isLoading()}
          >
            <i class={`codicon codicon-refresh ${isLoading() ? "codicon-modifier-spin" : ""}`} />
          </button>
          <button
            onClick={clearSearch}
            title="Clear Search"
            disabled={!query() && groups().length === 0}
          >
            <i class="codicon codicon-clear-all" />
          </button>
          <button
            onClick={toggleCollapseAll}
            title="Toggle Collapse All"
            disabled={groups().length === 0}
          >
            <i class="codicon codicon-collapse-all" />
          </button>
        </div>
      </div>

      {/* Input Box with Match Case toggle */}
      <div class="sidebar-search-input-box">
        <div class="sidebar-search-input-wrapper">
          <i class="codicon codicon-search sidebar-search-icon" />
          <input
            ref={inputRef}
            class="sidebar-search-input"
            type="text"
            placeholder="Search files (e.g. function, class)..."
            value={query()}
            onInput={onInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                clearTimeout(debounceTimer);
                runSearch(query());
              }
            }}
          />
          <button
            class={`search-option-btn ${caseSensitive() ? "active" : ""}`}
            onClick={() => {
              setCaseSensitive(!caseSensitive());
              runSearch(query());
            }}
            title="Match Case (Alt+C)"
          >
            Aa
          </button>
          <Show when={query()}>
            <button
              class="search-clear-btn"
              onClick={clearSearch}
              title="Clear Search Input"
            >
              <i class="codicon codicon-close" />
            </button>
          </Show>
        </div>
      </div>

      {/* Results Header / Summary */}
      <div class="sidebar-search-summary">
        <Show when={isLoading()}>
          <span class="search-summary-loading">
            <i class="codicon codicon-loading codicon-modifier-spin" />
            Searching workspace...
          </span>
        </Show>
        <Show when={!isLoading() && query().trim()}>
          <Show
            when={groups().length > 0}
            fallback={<span class="search-summary-empty">No results found</span>}
          >
            <span class="search-summary-count">
              {totalMatches()} result{totalMatches() === 1 ? "" : "s"} in {groups().length} file{groups().length === 1 ? "" : "s"}
            </span>
          </Show>
        </Show>
        <Show when={!isLoading() && !query().trim()}>
          <span class="search-summary-hint">
            Type keyword to live ripgrep workspace
          </span>
        </Show>
      </div>

      {/* Results Tree */}
      <div class="sidebar-search-results">
        <For each={groups()}>
          {(group) => {
            const iconInfo = getFileIcon(group.name);
            return (
              <div class="search-file-group">
                {/* File Header */}
                <div
                  class="search-file-header"
                  onClick={() => toggleGroup(group.path)}
                >
                  <i
                    class={`codicon ${
                      group.expanded
                        ? "codicon-chevron-down"
                        : "codicon-chevron-right"
                    } search-chevron`}
                  />
                  <span
                    class="search-file-icon"
                    style={{ color: iconInfo.color }}
                  >
                    <i class={`codicon ${iconInfo.icon}`} />
                  </span>
                  <span class="search-file-name">{group.name}</span>
                  <span class="search-file-dir">
                    {group.rel_path.substring(
                      0,
                      group.rel_path.length - group.name.length
                    )}
                  </span>
                  <span class="search-file-badge">{group.matches.length}</span>
                </div>

                {/* File Matches List */}
                <Show when={group.expanded}>
                  <div class="search-file-matches">
                    <For each={group.matches}>
                      {(match) => (
                        <div
                          class="search-match-row"
                          onClick={() =>
                            handleMatchClick(
                              group.path,
                              group.name,
                              match.line_number
                            )
                          }
                          title={`${group.rel_path}:${match.line_number}`}
                        >
                          <span class="search-match-line-num">
                            {match.line_number}
                          </span>
                          <span class="search-match-snippet">
                            {highlightMatch(match.line_text.trim(), query())}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
