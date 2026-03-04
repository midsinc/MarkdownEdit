# MarkdownEdit - Design Document

## Overview

A minimalistic, feature-rich Markdown editor built as a single executable using Electron. Split-pane interface with Markdown source on the left and live preview on the right. Cross-platform (Windows + macOS) with Windows context menu integration via installer.

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Framework | Electron |
| Editor | CodeMirror 6 |
| Markdown rendering | markdown-it + highlight.js |
| Build/packaging | electron-builder |
| Theme system | CSS custom properties |

## Architecture

```
MarkdownEdit/
├── main.js                    # Electron main process (file I/O, menus, window)
├── preload.js                 # Secure bridge between main & renderer
├── renderer/
│   ├── index.html             # App shell
│   ├── styles/
│   │   ├── app.css            # Layout + toolbar
│   │   ├── dark.css           # Dark theme variables
│   │   └── light.css          # Light theme variables
│   ├── editor.js              # CodeMirror 6 setup + Markdown mode
│   ├── preview.js             # markdown-it live rendering
│   ├── toolbar.js             # Formatting buttons
│   ├── statusbar.js           # Word/char/line count
│   └── app.js                 # Main renderer orchestration
├── package.json
└── electron-builder.yml       # Build config (installers, file associations)
```

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [B] [I] [H1] [H2] [Link] [Img] [Code] [List]    [moon/sun] │
├────────────────────────────┬─────────────────────────────────┤
│                            │                                 │
│   Markdown Source          │   Live Preview                  │
│   (CodeMirror 6)           │   (markdown-it rendered HTML)   │
│                            │                                 │
├────────────────────────────┴─────────────────────────────────┤
│ Words: 342 | Characters: 1,847 | Line: 15, Col: 23          │
└──────────────────────────────────────────────────────────────┘
```

## Core Features

### File Operations
- Open file (Ctrl+O) via native file dialog, filtered to .md/.markdown
- Save file (Ctrl+S) — saves to current path, or prompts if untitled
- Save As (Ctrl+Shift+S) — always prompts for new path
- Rename — rename current file in-place
- Drag & drop .md files onto window to open
- Recent files list in File menu
- Unsaved changes indicator in title bar

### Editor (Left Pane)
- CodeMirror 6 with Markdown syntax highlighting
- Line numbers
- Find & replace (Ctrl+F / Ctrl+H) via CodeMirror built-in
- Undo/redo
- Auto-indent

### Preview (Right Pane)
- Live rendering via markdown-it on every keystroke (debounced ~150ms)
- Proportional scroll sync with editor
- Support for: headings, bold, italic, links, images, code blocks (with syntax highlighting via highlight.js), tables, lists, blockquotes, horizontal rules, task lists

### Toolbar
- Bold, Italic, Heading 1, Heading 2, Link, Image, Code block, List
- Each button inserts appropriate Markdown syntax at cursor position
- Keyboard shortcuts: Ctrl+B (bold), Ctrl+I (italic)

### Theme System
- Dark and light themes via CSS custom properties
- Toggle button in toolbar
- Preference persisted in localStorage across sessions

### Export
- Export to HTML — standalone HTML file with inline styles
- Export to PDF — via Electron's print-to-PDF API

### Status Bar
- Word count
- Character count
- Current line and column number

## Build & Distribution

### Windows
- NSIS installer via electron-builder
- File association for .md and .markdown
- Context menu entry: "Edit with MarkdownEdit"

### macOS
- DMG with .app bundle
- File association for .md and .markdown

## Key Behaviors
- Live preview updates on every keystroke (debounced ~150ms)
- Scroll sync — scrolling the editor scrolls the preview proportionally
- Unsaved changes indicator in title bar (asterisk)
- Drag & drop support for opening files
- Recent files remembered in File menu
- Theme preference persisted across sessions
- Single instance — opening a second file reuses the existing window (or opens a new tab)
