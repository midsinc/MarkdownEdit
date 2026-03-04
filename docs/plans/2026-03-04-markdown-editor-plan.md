# MarkdownEdit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-platform Markdown editor with split-pane live preview, packaged as a single executable with Windows context menu integration.

**Architecture:** Electron app with CodeMirror 6 editor (left pane) and markdown-it live preview (right pane). Main process handles file I/O and native dialogs; renderer handles UI. Communication via contextBridge/IPC. No bundler — Electron loads ES modules directly from node_modules.

**Tech Stack:** Electron 33+, CodeMirror 6, markdown-it, highlight.js, electron-builder, CSS custom properties for theming.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `electron-builder.yml`

**Step 1: Create package.json**

```json
{
  "name": "markdown-edit",
  "version": "1.0.0",
  "description": "A minimalistic, feature-rich Markdown editor",
  "main": "src/main.js",
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder",
    "dist:win": "electron-builder --win",
    "dist:mac": "electron-builder --mac"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^26.8.0"
  },
  "dependencies": {
    "@codemirror/commands": "^6.7.1",
    "@codemirror/lang-markdown": "^6.3.2",
    "@codemirror/language": "^6.10.6",
    "@codemirror/language-data": "^6.5.0",
    "@codemirror/search": "^6.5.8",
    "@codemirror/state": "^6.4.1",
    "@codemirror/theme-one-dark": "^6.1.2",
    "@codemirror/view": "^6.35.3",
    "codemirror": "^6.0.1",
    "highlight.js": "^11.10.0",
    "markdown-it": "^14.1.0"
  }
}
```

**Step 2: Create electron-builder.yml**

```yaml
appId: com.markdownedit.app
productName: MarkdownEdit
copyright: "Copyright 2026"

directories:
  buildResources: build
  output: dist

files:
  - src/**/*
  - renderer/**/*
  - node_modules/**/*
  - package.json

fileAssociations:
  - ext: md
    name: Markdown Document
    description: "Markdown text file"
    role: Editor
  - ext: markdown
    name: Markdown Document
    description: "Markdown text file"
    role: Editor

win:
  target:
    - target: nsis
      arch: [x64]
  icon: build/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: MarkdownEdit
  include: build/installer.nsh

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  category: public.app-category.productivity
  icon: build/icon.icns
  darkModeSupport: true
```

**Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

**Step 4: Commit**

```bash
git init
git add package.json package-lock.json electron-builder.yml
git commit -m "feat: scaffold project with Electron and dependencies"
```

---

### Task 2: Electron Main Process

**Files:**
- Create: `src/main.js`
- Create: `src/preload.js`

**Step 1: Create src/main.js**

```javascript
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

let mainWindow = null
let currentFilePath = null
const recentFiles = []
const MAX_RECENT = 10

function createWindow(fileToOpen = null) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'MarkdownEdit',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

  mainWindow.webContents.once('did-finish-load', () => {
    if (fileToOpen) {
      openFileInRenderer(fileToOpen)
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
  buildMenu()
}

function openFileInRenderer(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    currentFilePath = filePath
    addRecentFile(filePath)
    mainWindow.webContents.send('file:opened', { filePath, content })
    mainWindow.setTitle(`${path.basename(filePath)} - MarkdownEdit`)
  } catch (err) {
    dialog.showErrorBox('Error', `Could not open file: ${err.message}`)
  }
}

function addRecentFile(filePath) {
  const index = recentFiles.indexOf(filePath)
  if (index !== -1) recentFiles.splice(index, 1)
  recentFiles.unshift(filePath)
  if (recentFiles.length > MAX_RECENT) recentFiles.pop()
  buildMenu()
}

function buildMenu() {
  const isMac = process.platform === 'darwin'

  const recentSubmenu = recentFiles.length > 0
    ? recentFiles.map(fp => ({
        label: fp,
        click: () => openFileInRenderer(fp)
      }))
    : [{ label: 'No recent files', enabled: false }]

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
            })
            if (!canceled && filePaths.length > 0) {
              openFileInRenderer(filePaths[0])
            }
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu:save-as')
        },
        {
          label: 'Rename...',
          click: () => mainWindow.webContents.send('menu:rename')
        },
        { type: 'separator' },
        {
          label: 'Recent Files',
          submenu: recentSubmenu
        },
        { type: 'separator' },
        {
          label: 'Export as HTML...',
          click: () => mainWindow.webContents.send('menu:export-html')
        },
        {
          label: 'Export as PDF...',
          click: () => mainWindow.webContents.send('menu:export-pdf')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// --- IPC Handlers ---

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  })
  if (canceled || filePaths.length === 0) return null
  const filePath = filePaths[0]
  const content = fs.readFileSync(filePath, 'utf-8')
  currentFilePath = filePath
  addRecentFile(filePath)
  mainWindow.setTitle(`${path.basename(filePath)} - MarkdownEdit`)
  return { filePath, content }
})

ipcMain.handle('dialog:saveFile', async (_event, { filePath, content }) => {
  let savePath = filePath
  if (!savePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled) return null
    savePath = result.filePath
  }
  fs.writeFileSync(savePath, content, 'utf-8')
  currentFilePath = savePath
  addRecentFile(savePath)
  mainWindow.setTitle(`${path.basename(savePath)} - MarkdownEdit`)
  return savePath
})

ipcMain.handle('dialog:saveAs', async (_event, { content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (result.canceled) return null
  fs.writeFileSync(result.filePath, content, 'utf-8')
  currentFilePath = result.filePath
  addRecentFile(result.filePath)
  mainWindow.setTitle(`${path.basename(result.filePath)} - MarkdownEdit`)
  return result.filePath
})

ipcMain.handle('dialog:rename', async (_event, { oldPath }) => {
  if (!oldPath) return null
  const dir = path.dirname(oldPath)
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: oldPath,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (result.canceled) return null
  fs.renameSync(oldPath, result.filePath)
  currentFilePath = result.filePath
  addRecentFile(result.filePath)
  mainWindow.setTitle(`${path.basename(result.filePath)} - MarkdownEdit`)
  return result.filePath
})

ipcMain.handle('export:html', async (_event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'document.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  })
  if (result.canceled) return null
  fs.writeFileSync(result.filePath, html, 'utf-8')
  return result.filePath
})

ipcMain.handle('export:pdf', async (_event, { defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'document.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled) return null
  const pdfBuffer = await mainWindow.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 }
  })
  fs.writeFileSync(result.filePath, pdfBuffer)
  return result.filePath
})

ipcMain.on('title:update', (_event, title) => {
  if (mainWindow) mainWindow.setTitle(title)
})

// --- File open from command line args (Windows) ---
function getFileFromArgs(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2)
  return args.find(a => !a.startsWith('-') && fs.existsSync(a)) || null
}

// --- File open from OS (macOS) ---
let pendingFilePath = null

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (app.isReady() && mainWindow) {
    openFileInRenderer(filePath)
  } else {
    pendingFilePath = filePath
  }
})

// --- App lifecycle ---
app.whenReady().then(() => {
  const cliFile = getFileFromArgs(process.argv)
  createWindow(pendingFilePath || cliFile)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

**Step 2: Create src/preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (args) => ipcRenderer.invoke('dialog:saveFile', args),
  saveAs: (args) => ipcRenderer.invoke('dialog:saveAs', args),
  renameFile: (args) => ipcRenderer.invoke('dialog:rename', args),
  exportHtml: (args) => ipcRenderer.invoke('export:html', args),
  exportPdf: (args) => ipcRenderer.invoke('export:pdf', args),
  updateTitle: (title) => ipcRenderer.send('title:update', title),

  onFileOpened: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('file:opened', handler)
    return () => ipcRenderer.removeListener('file:opened', handler)
  },
  onMenuSave: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:save', handler)
    return () => ipcRenderer.removeListener('menu:save', handler)
  },
  onMenuSaveAs: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:save-as', handler)
    return () => ipcRenderer.removeListener('menu:save-as', handler)
  },
  onMenuRename: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:rename', handler)
    return () => ipcRenderer.removeListener('menu:rename', handler)
  },
  onMenuExportHtml: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:export-html', handler)
    return () => ipcRenderer.removeListener('menu:export-html', handler)
  },
  onMenuExportPdf: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu:export-pdf', handler)
    return () => ipcRenderer.removeListener('menu:export-pdf', handler)
  },

  platform: process.platform
})
```

**Step 3: Verify app launches (will show blank window)**

Run: `npx electron .`
Expected: A blank window opens with title "MarkdownEdit". Close it manually.

**Step 4: Commit**

```bash
git add src/main.js src/preload.js
git commit -m "feat: add Electron main process with file I/O and menu system"
```

---

### Task 3: App Shell HTML + CSS

**Files:**
- Create: `renderer/index.html`
- Create: `renderer/styles/app.css`
- Create: `renderer/styles/dark.css`
- Create: `renderer/styles/light.css`

**Step 1: Create renderer/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:;">
  <title>MarkdownEdit</title>
  <link rel="stylesheet" href="styles/app.css">
  <link rel="stylesheet" href="styles/light.css" id="theme-light">
  <link rel="stylesheet" href="styles/dark.css" id="theme-dark" disabled>
</head>
<body>
  <!-- Toolbar -->
  <div id="toolbar">
    <div class="toolbar-group">
      <button id="btn-bold" title="Bold (Ctrl+B)"><strong>B</strong></button>
      <button id="btn-italic" title="Italic (Ctrl+I)"><em>I</em></button>
      <button id="btn-h1" title="Heading 1">H1</button>
      <button id="btn-h2" title="Heading 2">H2</button>
      <button id="btn-h3" title="Heading 3">H3</button>
      <button id="btn-link" title="Insert Link">Link</button>
      <button id="btn-image" title="Insert Image">Img</button>
      <button id="btn-code" title="Code Block">Code</button>
      <button id="btn-ul" title="Unordered List">List</button>
      <button id="btn-ol" title="Ordered List">1.</button>
      <button id="btn-quote" title="Blockquote">&ldquo;</button>
      <button id="btn-hr" title="Horizontal Rule">&#8212;</button>
    </div>
    <div class="toolbar-right">
      <button id="btn-theme" title="Toggle theme">Theme</button>
    </div>
  </div>

  <!-- Main content area -->
  <div id="main">
    <div id="editor-pane">
      <div id="editor-container"></div>
    </div>
    <div id="divider"></div>
    <div id="preview-pane">
      <div id="preview-content"></div>
    </div>
  </div>

  <!-- Status bar -->
  <div id="statusbar">
    <span id="status-words">Words: 0</span>
    <span id="status-chars">Characters: 0</span>
    <span id="status-lines">Lines: 0</span>
    <span id="status-cursor">Ln 1, Col 1</span>
    <span id="status-file" class="status-right">Untitled</span>
  </div>

  <script src="app.js" type="module"></script>
</body>
</html>
```

**Step 2: Create renderer/styles/app.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* --- Toolbar --- */
#toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 8px;
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
}

.toolbar-group, .toolbar-right {
  display: flex;
  gap: 2px;
  -webkit-app-region: no-drag;
}

#toolbar button {
  background: var(--bg-button);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
  min-width: 32px;
  transition: background 0.15s;
}

#toolbar button:hover {
  background: var(--bg-button-hover);
}

#toolbar button:active {
  background: var(--bg-button-active);
}

/* --- Main layout --- */
#main {
  display: flex;
  height: calc(100vh - 40px - 28px); /* toolbar + statusbar */
}

#editor-pane {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

#editor-container {
  flex: 1;
  overflow: auto;
}

#editor-container .cm-editor {
  height: 100%;
}

#editor-container .cm-scroller {
  overflow: auto;
}

#divider {
  width: 3px;
  background: var(--border-color);
  cursor: col-resize;
  flex-shrink: 0;
}

#preview-pane {
  flex: 1;
  overflow: auto;
  background: var(--bg-preview);
}

#preview-content {
  padding: 20px 24px;
  max-width: 100%;
  line-height: 1.6;
  font-size: 15px;
  word-wrap: break-word;
}

/* --- Preview typography --- */
#preview-content h1 { font-size: 2em; margin: 0.67em 0 0.4em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
#preview-content h2 { font-size: 1.5em; margin: 0.83em 0 0.4em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
#preview-content h3 { font-size: 1.25em; margin: 1em 0 0.4em; }
#preview-content h4 { font-size: 1em; margin: 1em 0 0.4em; }
#preview-content p { margin: 0 0 1em; }
#preview-content a { color: var(--accent-color); text-decoration: none; }
#preview-content a:hover { text-decoration: underline; }

#preview-content code {
  background: var(--bg-code-inline);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.9em;
}

#preview-content pre {
  background: var(--bg-code-block);
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0 0 1em;
}

#preview-content pre code {
  background: transparent;
  padding: 0;
  font-size: 0.9em;
}

#preview-content blockquote {
  border-left: 4px solid var(--accent-color);
  margin: 0 0 1em;
  padding: 8px 16px;
  color: var(--text-secondary);
  background: var(--bg-blockquote);
}

#preview-content ul, #preview-content ol {
  margin: 0 0 1em;
  padding-left: 2em;
}

#preview-content li { margin: 0.25em 0; }

#preview-content table {
  border-collapse: collapse;
  margin: 0 0 1em;
  width: 100%;
}

#preview-content th, #preview-content td {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
}

#preview-content th {
  background: var(--bg-table-header);
  font-weight: 600;
}

#preview-content hr {
  border: none;
  border-top: 2px solid var(--border-color);
  margin: 1.5em 0;
}

#preview-content img {
  max-width: 100%;
  height: auto;
}

#preview-content input[type="checkbox"] {
  margin-right: 6px;
}

/* --- Status bar --- */
#statusbar {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-statusbar);
  border-top: 1px solid var(--border-color);
  gap: 16px;
}

.status-right {
  margin-left: auto;
}
```

**Step 3: Create renderer/styles/light.css**

```css
:root {
  --bg-primary: #ffffff;
  --bg-toolbar: #f8f8f8;
  --bg-preview: #ffffff;
  --bg-statusbar: #f0f0f0;
  --bg-button: transparent;
  --bg-button-hover: #e8e8e8;
  --bg-button-active: #d8d8d8;
  --bg-code-inline: #f0f0f0;
  --bg-code-block: #f6f8fa;
  --bg-blockquote: #f9f9f9;
  --bg-table-header: #f0f0f0;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --border-color: #e0e0e0;
  --accent-color: #0366d6;
}
```

**Step 4: Create renderer/styles/dark.css**

```css
:root {
  --bg-primary: #1e1e2e;
  --bg-toolbar: #181825;
  --bg-preview: #1e1e2e;
  --bg-statusbar: #181825;
  --bg-button: transparent;
  --bg-button-hover: #313244;
  --bg-button-active: #45475a;
  --bg-code-inline: #313244;
  --bg-code-block: #181825;
  --bg-blockquote: #181825;
  --bg-table-header: #313244;
  --text-primary: #cdd6f4;
  --text-secondary: #a6adc8;
  --border-color: #313244;
  --accent-color: #89b4fa;
}
```

**Step 5: Verify app renders the shell**

Run: `npx electron .`
Expected: Window with toolbar, empty split panes, and status bar.

**Step 6: Commit**

```bash
git add renderer/
git commit -m "feat: add app shell with HTML layout, toolbar, and light/dark CSS themes"
```

---

### Task 4: CodeMirror 6 Editor Integration

**Files:**
- Create: `renderer/editor.js`

**Step 1: Create renderer/editor.js**

Since Electron's renderer can't load ES modules from node_modules directly without a bundler, we need to use a bundler. We'll add esbuild as a lightweight build step.

First, update package.json to add esbuild and a build script.

**Modify: `package.json` — add to devDependencies and scripts:**

Add `"esbuild": "^0.24.0"` to devDependencies.

Add scripts:
```
"build": "esbuild renderer/app.js --bundle --outfile=renderer/bundle.js --platform=browser --format=iife --external:electron",
"start": "npm run build && electron .",
"watch": "esbuild renderer/app.js --bundle --outfile=renderer/bundle.js --platform=browser --format=iife --external:electron --watch"
```

Update `renderer/index.html`: change `<script src="app.js" type="module">` to `<script src="bundle.js"></script>`.

Now create the editor module:

```javascript
// renderer/editor.js
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, lineNumbers, keymap, drawSelection, highlightActiveLine }
  from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab }
  from '@codemirror/commands'
import { searchKeymap, search } from '@codemirror/search'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching }
  from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    fontSize: '15px',
    fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace'
  },
  '.cm-content': { caretColor: '#0366d6', padding: '12px 0' },
  '.cm-gutters': { backgroundColor: '#f5f5f5', color: '#999', borderRight: '1px solid #e0e0e0' },
  '.cm-activeLineGutter': { backgroundColor: '#e8f0fe' },
  '.cm-activeLine': { backgroundColor: '#f0f4ff' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#0366d6' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#b3d1ff' }
}, { dark: false })

const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    fontSize: '15px',
    fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace'
  },
  '.cm-content': { caretColor: '#89b4fa', padding: '12px 0' },
  '.cm-gutters': { backgroundColor: '#181825', color: '#6c7086', borderRight: '1px solid #313244' },
  '.cm-activeLineGutter': { backgroundColor: '#313244' },
  '.cm-activeLine': { backgroundColor: '#313244' + '40' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#89b4fa' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#45475a' }
}, { dark: true })

export const themeCompartment = new Compartment()

const baseExtensions = [
  lineNumbers(),
  history(),
  drawSelection(),
  highlightActiveLine(),
  bracketMatching(),
  markdown({
    base: markdownLanguage,
    codeLanguages: languages,
    addKeymap: true
  }),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  search({ top: false }),
  keymap.of([
    ...defaultKeymap,
    ...historyKeymap,
    ...searchKeymap,
    indentWithTab
  ]),
  EditorView.lineWrapping
]

export function createEditor({ parent, doc = '', dark = false, onChange, onCursorChange }) {
  const theme = dark ? [darkTheme, oneDark] : [lightTheme]

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && typeof onChange === 'function') {
      onChange(update.state.doc.toString())
    }
    if (update.selectionSet && typeof onCursorChange === 'function') {
      const pos = update.state.selection.main.head
      const line = update.state.doc.lineAt(pos)
      onCursorChange({ line: line.number, col: pos - line.from + 1 })
    }
  })

  const state = EditorState.create({
    doc,
    extensions: [
      ...baseExtensions,
      themeCompartment.of(theme),
      updateListener
    ]
  })

  return new EditorView({ state, parent })
}

export function setEditorTheme(view, dark) {
  const theme = dark ? [darkTheme, oneDark] : [lightTheme]
  view.dispatch({
    effects: themeCompartment.reconfigure(theme)
  })
}

export function getEditorContent(view) {
  return view.state.doc.toString()
}

export function setEditorContent(view, content) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content }
  })
}

export function insertAtCursor(view, before, after = '') {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const insertion = before + selected + after
  view.dispatch({
    changes: { from, to, insert: insertion },
    selection: {
      anchor: from + before.length,
      head: from + before.length + selected.length
    }
  })
  view.focus()
}
```

**Step 2: Verify editor renders (after building with the full app.js in the next task)**

This will be verified in Task 6 when we build the orchestration layer.

**Step 3: Commit**

```bash
git add renderer/editor.js package.json
git commit -m "feat: add CodeMirror 6 editor with Markdown support and theme switching"
```

---

### Task 5: Markdown Preview Engine

**Files:**
- Create: `renderer/preview.js`

**Step 1: Create renderer/preview.js**

```javascript
// renderer/preview.js
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true
        }).value
        return `<pre class="hljs"><code class="language-${lang}">${highlighted}</code></pre>`
      } catch (_) { /* fall through */ }
    }
    const escaped = md.utils.escapeHtml(str)
    return `<pre class="hljs"><code>${escaped}</code></pre>`
  }
})

// Enable task list checkboxes
md.use(taskListPlugin)

function taskListPlugin(md) {
  md.core.ruler.after('inline', 'task-lists', (state) => {
    const tokens = state.tokens
    for (let i = 2; i < tokens.length; i++) {
      if (tokens[i].type === 'inline' &&
          tokens[i - 1].type === 'paragraph_open' &&
          tokens[i - 2].type === 'list_item_open') {
        const content = tokens[i].content
        if (/^\[[ xX]\]\s/.test(content)) {
          const checked = /^\[[xX]\]/.test(content)
          tokens[i].content = content.replace(
            /^\[[ xX]\]\s/,
            `<input type="checkbox" disabled ${checked ? 'checked' : ''}> `
          )
          tokens[i].children = null // force re-parse
          // Re-parse the inline content
          tokens[i].children = []
          md.inline.parse(tokens[i].content, md, state.env, tokens[i].children)
        }
      }
    }
  })
}

export function renderMarkdown(source) {
  return md.render(source || '')
}
```

**Step 2: Commit**

```bash
git add renderer/preview.js
git commit -m "feat: add markdown-it preview engine with syntax highlighting and task lists"
```

---

### Task 6: Main App Orchestration

**Files:**
- Create: `renderer/app.js`

**Step 1: Create renderer/app.js**

```javascript
// renderer/app.js
import { createEditor, setEditorTheme, getEditorContent, setEditorContent, insertAtCursor } from './editor.js'
import { renderMarkdown } from './preview.js'

// --- State ---
let editor = null
let currentFilePath = null
let isDirty = false
let isDark = localStorage.getItem('theme') === 'dark'
let debounceTimer = null

// --- Init ---
function init() {
  applyTheme(isDark)

  editor = createEditor({
    parent: document.getElementById('editor-container'),
    doc: '',
    dark: isDark,
    onChange: (text) => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => updatePreview(text), 150)
      markDirty()
      updateWordCount(text)
    },
    onCursorChange: ({ line, col }) => {
      document.getElementById('status-cursor').textContent = `Ln ${line}, Col ${col}`
    }
  })

  setupToolbar()
  setupDividerDrag()
  setupMenuListeners()
  setupDragDrop()

  // Initial preview
  updatePreview('')
}

// --- Preview ---
function updatePreview(text) {
  const html = renderMarkdown(text)
  document.getElementById('preview-content').innerHTML = html
}

// --- Theme ---
function applyTheme(dark) {
  document.getElementById('theme-light').disabled = dark
  document.getElementById('theme-dark').disabled = !dark
  if (editor) setEditorTheme(editor, dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

function toggleTheme() {
  isDark = !isDark
  applyTheme(isDark)
}

// --- Dirty state ---
function markDirty() {
  if (!isDirty) {
    isDirty = true
    updateTitleBar()
  }
}

function markClean() {
  isDirty = false
  updateTitleBar()
}

function updateTitleBar() {
  const fileName = currentFilePath
    ? currentFilePath.split(/[/\\]/).pop()
    : 'Untitled'
  const dirtyMarker = isDirty ? ' *' : ''
  const title = `${fileName}${dirtyMarker} - MarkdownEdit`
  document.title = title
  window.electronAPI.updateTitle(title)
  document.getElementById('status-file').textContent = currentFilePath || 'Untitled'
}

// --- Word count ---
function updateWordCount(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const chars = text.length
  const lines = text.split('\n').length
  document.getElementById('status-words').textContent = `Words: ${words.toLocaleString()}`
  document.getElementById('status-chars').textContent = `Characters: ${chars.toLocaleString()}`
  document.getElementById('status-lines').textContent = `Lines: ${lines.toLocaleString()}`
}

// --- Toolbar ---
function setupToolbar() {
  document.getElementById('btn-bold').addEventListener('click', () => insertAtCursor(editor, '**', '**'))
  document.getElementById('btn-italic').addEventListener('click', () => insertAtCursor(editor, '*', '*'))
  document.getElementById('btn-h1').addEventListener('click', () => insertAtCursor(editor, '# ', ''))
  document.getElementById('btn-h2').addEventListener('click', () => insertAtCursor(editor, '## ', ''))
  document.getElementById('btn-h3').addEventListener('click', () => insertAtCursor(editor, '### ', ''))
  document.getElementById('btn-link').addEventListener('click', () => insertAtCursor(editor, '[', '](url)'))
  document.getElementById('btn-image').addEventListener('click', () => insertAtCursor(editor, '![alt](', ')'))
  document.getElementById('btn-code').addEventListener('click', () => insertAtCursor(editor, '```\n', '\n```'))
  document.getElementById('btn-ul').addEventListener('click', () => insertAtCursor(editor, '- ', ''))
  document.getElementById('btn-ol').addEventListener('click', () => insertAtCursor(editor, '1. ', ''))
  document.getElementById('btn-quote').addEventListener('click', () => insertAtCursor(editor, '> ', ''))
  document.getElementById('btn-hr').addEventListener('click', () => insertAtCursor(editor, '\n---\n', ''))
  document.getElementById('btn-theme').addEventListener('click', toggleTheme)
}

// --- Resizable divider ---
function setupDividerDrag() {
  const divider = document.getElementById('divider')
  const main = document.getElementById('main')
  const editorPane = document.getElementById('editor-pane')
  const previewPane = document.getElementById('preview-pane')

  let isDragging = false

  divider.addEventListener('mousedown', (e) => {
    isDragging = true
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    const rect = main.getBoundingClientRect()
    const percent = ((e.clientX - rect.left) / rect.width) * 100
    const clamped = Math.max(20, Math.min(80, percent))
    editorPane.style.flex = `0 0 ${clamped}%`
    previewPane.style.flex = `0 0 ${100 - clamped}%`
  })

  document.addEventListener('mouseup', () => {
    isDragging = false
  })
}

// --- Menu listeners (from main process) ---
function setupMenuListeners() {
  window.electronAPI.onFileOpened(({ filePath, content }) => {
    currentFilePath = filePath
    setEditorContent(editor, content)
    updatePreview(content)
    updateWordCount(content)
    markClean()
  })

  window.electronAPI.onMenuSave(async () => {
    const content = getEditorContent(editor)
    const result = await window.electronAPI.saveFile({ filePath: currentFilePath, content })
    if (result) {
      currentFilePath = result
      markClean()
    }
  })

  window.electronAPI.onMenuSaveAs(async () => {
    const content = getEditorContent(editor)
    const result = await window.electronAPI.saveAs({ content })
    if (result) {
      currentFilePath = result
      markClean()
    }
  })

  window.electronAPI.onMenuRename(async () => {
    if (!currentFilePath) return
    const result = await window.electronAPI.renameFile({ oldPath: currentFilePath })
    if (result) {
      currentFilePath = result
      markClean()
    }
  })

  window.electronAPI.onMenuExportHtml(async () => {
    const content = getEditorContent(editor)
    const html = buildExportHtml(content)
    const defaultName = currentFilePath
      ? currentFilePath.replace(/\.(md|markdown)$/i, '.html')
      : 'document.html'
    await window.electronAPI.exportHtml({ html, defaultName })
  })

  window.electronAPI.onMenuExportPdf(async () => {
    const defaultName = currentFilePath
      ? currentFilePath.replace(/\.(md|markdown)$/i, '.pdf')
      : 'document.pdf'
    await window.electronAPI.exportPdf({ defaultName })
  })

  // Keyboard shortcuts for save
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
      e.preventDefault()
      const content = getEditorContent(editor)
      const result = await window.electronAPI.saveFile({ filePath: currentFilePath, content })
      if (result) {
        currentFilePath = result
        markClean()
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && e.shiftKey) {
      e.preventDefault()
      const content = getEditorContent(editor)
      const result = await window.electronAPI.saveAs({ content })
      if (result) {
        currentFilePath = result
        markClean()
      }
    }
  })
}

// --- Drag & drop ---
function setupDragDrop() {
  document.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  document.addEventListener('drop', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file && /\.(md|markdown|txt)$/i.test(file.name)) {
      const text = await file.text()
      currentFilePath = file.path
      setEditorContent(editor, text)
      updatePreview(text)
      updateWordCount(text)
      markClean()
    }
  })
}

// --- Export HTML ---
function buildExportHtml(markdownSource) {
  const renderedBody = renderMarkdown(markdownSource)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${currentFilePath ? currentFilePath.split(/[/\\]/).pop().replace(/\.(md|markdown)$/i, '') : 'Document'}</title>
  <style>
    body { max-width: 800px; margin: 40px auto; padding: 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    h1, h2 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Consolas', monospace; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 4px solid #0366d6; padding: 8px 16px; margin: 0 0 1em; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; }
    th { background: #f0f0f0; }
    img { max-width: 100%; }
  </style>
</head>
<body>${renderedBody}</body>
</html>`
}

// --- Scroll sync ---
function setupScrollSync() {
  const editorScroller = document.querySelector('#editor-container .cm-scroller')
  const previewPane = document.getElementById('preview-pane')

  if (editorScroller) {
    editorScroller.addEventListener('scroll', () => {
      const editorPercent = editorScroller.scrollTop / (editorScroller.scrollHeight - editorScroller.clientHeight || 1)
      previewPane.scrollTop = editorPercent * (previewPane.scrollHeight - previewPane.clientHeight)
    })
  }
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  init()
  // Scroll sync needs editor to be mounted first
  requestAnimationFrame(setupScrollSync)
})
```

**Step 2: Run: `npm run build && npx electron .`**

Expected: Full editor loads with toolbar, split panes, live preview, status bar, theme toggle.

**Step 3: Commit**

```bash
git add renderer/app.js renderer/index.html package.json
git commit -m "feat: add app orchestration with toolbar, file ops, theme toggle, and scroll sync"
```

---

### Task 7: Build Resources and Installer Config

**Files:**
- Create: `build/installer.nsh`
- Create: `build/entitlements.mac.plist`

**Step 1: Create build/installer.nsh**

```nsh
!macro customInstall
  WriteRegStr HKCR ".md\shell\MarkdownEdit" "" "Edit with MarkdownEdit"
  WriteRegStr HKCR ".md\shell\MarkdownEdit" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR ".md\shell\MarkdownEdit\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  WriteRegStr HKCR ".markdown\shell\MarkdownEdit" "" "Edit with MarkdownEdit"
  WriteRegStr HKCR ".markdown\shell\MarkdownEdit" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR ".markdown\shell\MarkdownEdit\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUninstall
  DeleteRegKey HKCR ".md\shell\MarkdownEdit"
  DeleteRegKey HKCR ".markdown\shell\MarkdownEdit"
!macroend
```

**Step 2: Create build/entitlements.mac.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
</dict>
</plist>
```

**Step 3: Create a placeholder icon (will be replaced with a real one later)**

Create a simple SVG that can be converted to ICO/ICNS later. For now, the build will work without icons by using Electron defaults.

**Step 4: Commit**

```bash
git add build/
git commit -m "feat: add installer config for Windows context menu and macOS entitlements"
```

---

### Task 8: highlight.js Theme CSS

**Files:**
- Create: `renderer/styles/hljs-light.css`
- Create: `renderer/styles/hljs-dark.css`
- Modify: `renderer/index.html` — add highlight.js stylesheet links

**Step 1: Create renderer/styles/hljs-light.css**

Copy a minimal highlight.js GitHub-style light theme for code blocks in the preview pane.

```css
/* highlight.js GitHub Light */
.hljs { background: #f6f8fa; color: #24292e; }
.hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
.hljs-keyword, .hljs-selector-tag { color: #d73a49; }
.hljs-string, .hljs-addition { color: #032f62; }
.hljs-number, .hljs-literal { color: #005cc5; }
.hljs-built_in, .hljs-type { color: #6f42c1; }
.hljs-title, .hljs-section { color: #6f42c1; font-weight: bold; }
.hljs-name, .hljs-selector-id, .hljs-selector-class { color: #22863a; }
.hljs-attr, .hljs-attribute { color: #005cc5; }
.hljs-deletion { color: #b31d28; background: #ffeef0; }
.hljs-meta { color: #735c0f; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
```

**Step 2: Create renderer/styles/hljs-dark.css**

```css
/* highlight.js Catppuccin Dark */
.hljs { background: #181825; color: #cdd6f4; }
.hljs-comment, .hljs-quote { color: #6c7086; font-style: italic; }
.hljs-keyword, .hljs-selector-tag { color: #cba6f7; }
.hljs-string, .hljs-addition { color: #a6e3a1; }
.hljs-number, .hljs-literal { color: #fab387; }
.hljs-built_in, .hljs-type { color: #f9e2af; }
.hljs-title, .hljs-section { color: #89b4fa; font-weight: bold; }
.hljs-name, .hljs-selector-id, .hljs-selector-class { color: #a6e3a1; }
.hljs-attr, .hljs-attribute { color: #89dceb; }
.hljs-deletion { color: #f38ba8; background: #45475a; }
.hljs-meta { color: #f9e2af; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
```

**Step 3: Modify renderer/index.html — add hljs stylesheet links**

Add after the dark.css link:
```html
<link rel="stylesheet" href="styles/hljs-light.css" id="hljs-light">
<link rel="stylesheet" href="styles/hljs-dark.css" id="hljs-dark" disabled>
```

**Step 4: Modify renderer/app.js — update applyTheme to toggle hljs styles**

In the `applyTheme` function, add:
```javascript
document.getElementById('hljs-light').disabled = dark
document.getElementById('hljs-dark').disabled = !dark
```

**Step 5: Verify code blocks render with syntax highlighting**

Run: `npm run build && npx electron .`
Type a fenced code block in the editor (e.g., \`\`\`javascript ... \`\`\`).
Expected: Code block in preview has syntax-colored text.

**Step 6: Commit**

```bash
git add renderer/styles/hljs-light.css renderer/styles/hljs-dark.css renderer/index.html renderer/app.js
git commit -m "feat: add highlight.js themes for code block syntax coloring in preview"
```

---

### Task 9: End-to-End Testing & Polish

**Files:**
- Modify: `renderer/app.js` — fix any issues found during testing

**Step 1: Test all file operations**

Run: `npm run build && npx electron .`

Test checklist:
1. Type Markdown in editor — preview updates live
2. File > Open — loads a .md file
3. Ctrl+S — saves (prompts for path if untitled)
4. Ctrl+Shift+S — save as
5. File > Rename — renames current file
6. Drag & drop a .md file onto the window
7. Theme toggle button switches light/dark
8. Toolbar buttons insert correct Markdown syntax
9. Ctrl+F opens find panel in editor
10. Status bar shows correct word/char/line count and cursor position
11. Export as HTML — produces valid standalone HTML
12. Export as PDF — produces readable PDF
13. Scroll sync — scrolling editor moves preview proportionally
14. Resizable divider — drag to resize panes

**Step 2: Fix any issues found**

Address bugs discovered during testing.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: polish and bug fixes from end-to-end testing"
```

---

### Task 10: Build Distributable

**Step 1: Build for current platform**

Run: `npm run dist`
Expected: Installer created in `dist/` folder.

**Step 2: Test the built installer**

- On Windows: Run the NSIS installer, verify app installs and launches
- Verify .md files show "Edit with MarkdownEdit" in right-click context menu
- Verify double-clicking a .md file opens it in MarkdownEdit

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: verify distributable build"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding | `package.json`, `electron-builder.yml` |
| 2 | Electron main process | `src/main.js`, `src/preload.js` |
| 3 | App shell HTML + CSS | `renderer/index.html`, `renderer/styles/*.css` |
| 4 | CodeMirror 6 editor | `renderer/editor.js` |
| 5 | Markdown preview engine | `renderer/preview.js` |
| 6 | App orchestration | `renderer/app.js` |
| 7 | Build resources | `build/installer.nsh`, `build/entitlements.mac.plist` |
| 8 | highlight.js themes | `renderer/styles/hljs-*.css` |
| 9 | End-to-end testing | All files |
| 10 | Build distributable | `dist/` output |
