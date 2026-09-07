import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('docs/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

console.log("Starting preview server...");
const previewProc = spawn('./node_modules/.bin/vite', ['preview', '--port', '4173'], {
  stdio: 'ignore'
});

for (let i = 0; i < 30; i++) {
  try {
    const r = await fetch('http://127.0.0.1:4173/');
    if (r.ok) break;
  } catch (e) {
    await new Promise((res) => setTimeout(res, 200));
  }
}
console.log("Preview server ready.");

console.log("Launching Brave...");
const braveProc = spawn(
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  [
    '--headless',
    '--remote-debugging-port=9222',
    '--window-size=1380,860',
    '--hide-scrollbars',
    '--disable-gpu',
    'http://localhost:4173'
  ],
  { stdio: 'ignore' }
);

let wsUrl = null;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/list');
    const list = await res.json();
    const page = list.find((t) => t.type === 'page');
    if (page && page.webSocketDebuggerUrl) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch (e) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

if (!wsUrl) {
  console.error("Failed to connect to Brave CDP");
  previewProc.kill();
  process.exit(1);
}

const ws = new WebSocket(wsUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve));

let reqId = 1;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = reqId++;
    const onMsg = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', onMsg);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Page.enable');
await send('Runtime.enable');

async function evaluate(code) {
  const res = await send('Runtime.evaluate', {
    expression: code,
    awaitPromise: true,
    returnByValue: true
  });
  if (res.exceptionDetails) {
    console.error("Eval error:", res.exceptionDetails);
  }
  return res.result?.value;
}

async function capture(filename) {
  await new Promise((r) => setTimeout(r, 800));
  const res = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  });
  const filePath = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
  console.log(`Saved ${filename} (${fs.statSync(filePath).size} bytes)`);
}

// Inject Tauri mock
await evaluate(`
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd, args) => {
      if (cmd === 'search_files') {
        const q = (args && args.query || '').toLowerCase();
        const all = [
          { path: '/Users/chait/code/cmx/src/components/Editor.tsx', rel_path: 'src/components/Editor.tsx', name: 'Editor.tsx' },
          { path: '/Users/chait/code/cmx/src/components/LivePreview.tsx', rel_path: 'src/components/LivePreview.tsx', name: 'LivePreview.tsx' },
          { path: '/Users/chait/code/cmx/src/components/QuickOpen.tsx', rel_path: 'src/components/QuickOpen.tsx', name: 'QuickOpen.tsx' },
          { path: '/Users/chait/code/cmx/src/components/TitleBar.tsx', rel_path: 'src/components/TitleBar.tsx', name: 'TitleBar.tsx' },
          { path: '/Users/chait/code/cmx/src/App.tsx', rel_path: 'src/App.tsx', name: 'App.tsx' }
        ];
        return all.filter(f => f.rel_path.toLowerCase().includes(q));
      }
      return [];
    }
  };
`);

console.log("Waiting for editor store...");
for (let i = 0; i < 30; i++) {
  const ready = await evaluate(`typeof window.editorStore !== 'undefined'`);
  if (ready) break;
  await new Promise((r) => setTimeout(r, 200));
}

console.log("Injecting state...");
await evaluate(`
  (() => {
    const store = window.editorStore;
    store.setRootPath('/Users/chait/code/cmx');

    store.setFileTree([
      {
        name: 'src',
        path: '/Users/chait/code/cmx/src',
        isDir: true,
        expanded: true,
        children: [
          { name: 'components', path: '/Users/chait/code/cmx/src/components', isDir: true, expanded: true, children: [
            { name: 'Editor.tsx', path: '/Users/chait/code/cmx/src/components/Editor.tsx', isDir: false },
            { name: 'LivePreview.tsx', path: '/Users/chait/code/cmx/src/components/LivePreview.tsx', isDir: false },
            { name: 'QuickOpen.tsx', path: '/Users/chait/code/cmx/src/components/QuickOpen.tsx', isDir: false },
            { name: 'TitleBar.tsx', path: '/Users/chait/code/cmx/src/components/TitleBar.tsx', isDir: false }
          ]},
          { name: 'stores', path: '/Users/chait/code/cmx/src/stores', isDir: true, expanded: false, children: [] },
          { name: 'App.tsx', path: '/Users/chait/code/cmx/src/App.tsx', isDir: false },
          { name: 'App.css', path: '/Users/chait/code/cmx/src/App.css', isDir: false }
        ]
      },
      {
        name: 'src-tauri',
        path: '/Users/chait/code/cmx/src-tauri',
        isDir: true,
        expanded: false,
        children: []
      },
      { name: 'Cargo.toml', path: '/Users/chait/code/cmx/Cargo.toml', isDir: false },
      { name: 'package.json', path: '/Users/chait/code/cmx/package.json', isDir: false },
      { name: 'README.md', path: '/Users/chait/code/cmx/README.md', isDir: false }
    ]);

    const appTsxContent = [
      'import { createSignal, createEffect, onMount } from "solid-js";',
      'import { editorStore } from "./stores/editor";',
      'import TitleBar from "./components/TitleBar";',
      'import Sidebar from "./components/Sidebar";',
      'import Editor from "./components/Editor";',
      'import LivePreview from "./components/LivePreview";',
      '',
      '/**',
      ' * cmx editor — Sub-10MB native code editor',
      ' * Built with Tauri 2, CodeMirror 6, and Solid.js.',
      ' */',
      'export default function App() {',
      '  const { theme, isVimMode, openSearch, canPreview } = editorStore;',
      '  const [isReady, setIsReady] = createSignal(true);',
      '',
      '  onMount(async () => {',
      '    console.log("cmx workspace initialized with modal editing and ripgrep search");',
      '  });',
      '',
      '  return (',
      '    <div class="app-root" data-theme={theme()}>',
      '      <TitleBar />',
      '      <div class="workspace-layout">',
      '        <Sidebar />',
      '        <div class="editor-container">',
      '          <Editor />',
      '          <LivePreview />',
      '        </div>',
      '      </div>',
      '    </div>',
      '  );',
      '}'
    ].join('\\n');

    const readmeContent = [
      '# cmx editor',
      '',
      'A fast, lightweight code editor with modal editing, instant workspace search, and live preview.',
      '',
      '## Key Features',
      '',
      '- **Sub-10MB Binary**: Instant cold launch using native OS webview.',
      '- **CodeMirror 6 Core**: Syntax highlighting, bracket matching, multiple cursors.',
      '- **Vim Modal Editing**: Full Normal, Insert, and Visual modes with Ex commands.',
      '- **Instant Search**: Telescope-style file finder and ripgrep across workspace.',
      '- **Live Split Preview**: Real-time Markdown rendering and HTML sandbox.',
      '',
      '\\x60\\x60\\x60bash',
      '# Build and run cmx',
      'pnpm install',
      'cargo tauri dev',
      '\\x60\\x60\\x60'
    ].join('\\n');

    const mainRsContent = [
      '// Prevents additional console window on Windows in release',
      '#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]',
      '',
      'mod commands;',
      '',
      'fn main() {',
      '    tauri::Builder::default()',
      '        .plugin(tauri_plugin_dialog::init())',
      '        .invoke_handler(tauri::generate_context!())',
      '        .run(tauri::generate_context!())',
      '        .expect("error while running cmx editor");',
      '}'
    ].join('\\n');

    store.setOpenFiles([
      { path: 'untitled://App.tsx', name: 'App.tsx', content: appTsxContent, language: 'typescript' },
      { path: 'untitled://main.rs', name: 'main.rs', content: mainRsContent, language: 'rust' },
      { path: 'untitled://README.md', name: 'README.md', content: readmeContent, language: 'markdown' }
    ]);
    store.setActiveFilePath('untitled://App.tsx');
    if (!store.isVimMode()) store.toggleVimMode();
    store.setVimModeStatus('NORMAL');
    store.setTheme('dark');
  })()
`);

console.log("Capturing 01-workspace-dark.png...");
await capture('01-workspace-dark.png');

console.log("Capturing 02-workspace-light.png...");
await evaluate(`window.editorStore.setTheme('light')`);
await capture('02-workspace-light.png');

console.log("Capturing 03-quick-open.png...");
await evaluate(`
  (async () => {
    window.editorStore.setTheme('dark');
    window.editorStore.openSearch('commands');
    await new Promise(r => setTimeout(r, 100));
    const input = document.querySelector('.quickopen-input');
    if (input) {
      input.value = 'Editor';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()
`);
await new Promise((r) => setTimeout(r, 600));
await capture('03-quick-open.png');
await evaluate(`window.editorStore.closeSearch()`);

console.log("Capturing 04-search-preview.png...");
await evaluate(`
  (() => {
    window.editorStore.setActiveFilePath('untitled://README.md');
    window.editorStore.togglePreview();
  })()
`);
await new Promise((r) => setTimeout(r, 600));
await capture('04-search-preview.png');
await evaluate(`window.editorStore.togglePreview()`);

console.log("Capturing 05-settings.png...");
await evaluate(`window.editorStore.openFontModal()`);
await new Promise((r) => setTimeout(r, 600));
await capture('05-settings.png');

console.log("All screenshots captured successfully!");
previewProc.kill();
braveProc.kill();
process.exit(0);
