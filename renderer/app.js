// renderer/app.js
import { createEditor, setEditorTheme, getEditorContent, setEditorContent, insertAtCursor } from './editor.js'
import { renderMarkdown } from './preview.js'

// --- Tab State ---
const tabs = new Map() // id -> { filePath, content, isDirty, scrollTop, cursorPos }
let activeTabId = null
let tabCounter = 0

// --- Global State ---
let editor = null
let isDark = localStorage.getItem('theme') === 'dark'
let debounceTimer = null

// --- Helpers ---
function getActiveTab() {
  return activeTabId ? tabs.get(activeTabId) : null
}

function getTabName(tab) {
  if (tab.filePath) return tab.filePath.split(/[/\\]/).pop()
  return 'Untitled'
}

// --- Tab Management ---
function createTab(filePath = null, content = '') {
  tabCounter++
  const id = 'tab-' + tabCounter

  const tab = {
    id,
    filePath,
    content,
    isDirty: false,
    scrollTop: 0,
    cursorPos: 0
  }

  tabs.set(id, tab)
  renderTabBar()
  activateTab(id)
  return id
}

function activateTab(tabId) {
  const tab = tabs.get(tabId)
  if (!tab) return

  // Save current tab state before switching
  if (activeTabId && tabs.has(activeTabId)) {
    saveCurrentTabState()
  }

  activeTabId = tabId

  // Load tab content into editor
  if (editor) {
    setEditorContent(editor, tab.content)

    // Restore cursor position
    try {
      const pos = Math.min(tab.cursorPos, tab.content.length)
      editor.dispatch({ selection: { anchor: pos, head: pos } })
    } catch (_) { /* ignore invalid position */ }

    // Restore scroll position after content loads
    requestAnimationFrame(() => {
      const scroller = document.querySelector('#editor-container .cm-scroller')
      if (scroller) scroller.scrollTop = tab.scrollTop
    })

    editor.focus()
  }

  // Update preview
  updatePreview(tab.content)
  updateWordCount(tab.content)
  updateTitleBar()
  renderTabBar()
}

function saveCurrentTabState() {
  const tab = getActiveTab()
  if (!tab || !editor) return

  tab.content = getEditorContent(editor)

  // Save cursor position
  try {
    tab.cursorPos = editor.state.selection.main.head
  } catch (_) {
    tab.cursorPos = 0
  }

  // Save scroll position
  const scroller = document.querySelector('#editor-container .cm-scroller')
  if (scroller) tab.scrollTop = scroller.scrollTop
}

function closeTab(tabId) {
  const tab = tabs.get(tabId)
  if (!tab) return

  // If dirty, confirm with user
  if (tab.isDirty) {
    const name = getTabName(tab)
    if (!confirm('Save changes to ' + name + ' before closing?')) {
      // User said "No" to saving — just close
    }
    // Note: a proper implementation would offer Save/Don't Save/Cancel
    // For now, we just close without saving if they click "Cancel"/"OK"
  }

  tabs.delete(tabId)

  // If we closed the active tab, activate a neighbor
  if (activeTabId === tabId) {
    activeTabId = null
    const remaining = Array.from(tabs.keys())
    if (remaining.length > 0) {
      activateTab(remaining[remaining.length - 1])
    } else {
      // No tabs left, create a fresh one
      createTab()
      return
    }
  }

  renderTabBar()
}

function renderTabBar() {
  const container = document.getElementById('tabs-container')
  container.innerHTML = ''

  for (const [id, tab] of tabs) {
    const el = document.createElement('div')
    el.className = 'tab' + (id === activeTabId ? ' active' : '')
    el.dataset.tabId = id

    const title = document.createElement('span')
    title.className = 'tab-title'
    const name = getTabName(tab)
    title.textContent = tab.isDirty ? name + ' *' : name
    title.title = tab.filePath || 'Untitled'
    el.appendChild(title)

    const close = document.createElement('button')
    close.className = 'tab-close'
    close.textContent = '\u00d7'
    close.title = 'Close'
    close.addEventListener('click', (e) => {
      e.stopPropagation()
      closeTab(id)
    })
    el.appendChild(close)

    el.addEventListener('click', () => {
      if (activeTabId !== id) activateTab(id)
    })

    // Middle-click to close
    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault()
        closeTab(id)
      }
    })

    container.appendChild(el)
  }
}

// --- Init ---
function init() {
  applyTheme(isDark)

  editor = createEditor({
    parent: document.getElementById('editor-container'),
    doc: '',
    dark: isDark,
    onChange: (text) => {
      const tab = getActiveTab()
      if (tab) {
        tab.content = text
        markDirty(activeTabId)
      }
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => updatePreview(text), 150)
      updateWordCount(text)
    },
    onCursorChange: ({ line, col }) => {
      document.getElementById('status-cursor').textContent = 'Ln ' + line + ', Col ' + col
    }
  })

  setupToolbar()
  setupDividerDrag()
  setupMenuListeners()
  setupDragDrop()
  setupTabShortcuts()

  // Create first empty tab
  createTab()
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
  document.getElementById('hljs-light').disabled = dark
  document.getElementById('hljs-dark').disabled = !dark
  if (editor) setEditorTheme(editor, dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

function toggleTheme() {
  isDark = !isDark
  applyTheme(isDark)
}

// --- Dirty state (per tab) ---
function markDirty(tabId) {
  const tab = tabs.get(tabId)
  if (tab && !tab.isDirty) {
    tab.isDirty = true
    updateTitleBar()
    renderTabBar()
  }
}

function markClean(tabId) {
  const tab = tabs.get(tabId || activeTabId)
  if (tab) {
    tab.isDirty = false
    updateTitleBar()
    renderTabBar()
  }
}

function updateTitleBar() {
  const tab = getActiveTab()
  if (!tab) return
  const fileName = getTabName(tab)
  const dirtyMarker = tab.isDirty ? ' *' : ''
  const title = fileName + dirtyMarker + ' - MarkdownEdit'
  document.title = title
  window.electronAPI.updateTitle(title)
  document.getElementById('status-file').textContent = tab.filePath || 'Untitled'
}

// --- Word count ---
function updateWordCount(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const chars = text.length
  const lines = text.split('\n').length
  document.getElementById('status-words').textContent = 'Words: ' + words.toLocaleString()
  document.getElementById('status-chars').textContent = 'Characters: ' + chars.toLocaleString()
  document.getElementById('status-lines').textContent = 'Lines: ' + lines.toLocaleString()
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

  // New tab button
  document.getElementById('btn-new-tab').addEventListener('click', () => createTab())
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
    editorPane.style.flex = '0 0 ' + clamped + '%'
    previewPane.style.flex = '0 0 ' + (100 - clamped) + '%'
  })

  document.addEventListener('mouseup', () => {
    isDragging = false
  })
}

// --- Open file into a tab ---
function openFileInTab(filePath, content) {
  // Check if file is already open in a tab
  for (const [id, tab] of tabs) {
    if (tab.filePath === filePath) {
      activateTab(id)
      return
    }
  }

  // If active tab is untitled and clean and empty, reuse it
  const active = getActiveTab()
  if (active && !active.filePath && !active.isDirty && !active.content) {
    active.filePath = filePath
    active.content = content
    active.isDirty = false
    setEditorContent(editor, content)
    updatePreview(content)
    updateWordCount(content)
    updateTitleBar()
    renderTabBar()
    return
  }

  // Otherwise create new tab
  const tabId = createTab(filePath, content)
}

// --- Menu listeners (from main process) ---
function setupMenuListeners() {
  window.electronAPI.onFileOpened(({ filePath, content }) => {
    openFileInTab(filePath, content)
  })

  window.electronAPI.onMenuNewTab(() => {
    createTab()
  })

  window.electronAPI.onMenuCloseTab(() => {
    if (activeTabId) closeTab(activeTabId)
  })

  window.electronAPI.onMenuSave(async () => {
    const tab = getActiveTab()
    if (!tab) return
    const content = getEditorContent(editor)
    const result = await window.electronAPI.saveFile({ filePath: tab.filePath, content })
    if (result) {
      tab.filePath = result
      markClean(activeTabId)
    }
  })

  window.electronAPI.onMenuSaveAs(async () => {
    const tab = getActiveTab()
    if (!tab) return
    const content = getEditorContent(editor)
    const result = await window.electronAPI.saveAs({ content })
    if (result) {
      tab.filePath = result
      markClean(activeTabId)
    }
  })

  window.electronAPI.onMenuRename(async () => {
    const tab = getActiveTab()
    if (!tab || !tab.filePath) return
    const result = await window.electronAPI.renameFile({ oldPath: tab.filePath })
    if (result) {
      tab.filePath = result
      markClean(activeTabId)
    }
  })

  window.electronAPI.onMenuExportHtml(async () => {
    const tab = getActiveTab()
    if (!tab) return
    const content = getEditorContent(editor)
    const html = buildExportHtml(content)
    const defaultName = tab.filePath
      ? tab.filePath.replace(/\.(md|markdown)$/i, '.html')
      : 'document.html'
    await window.electronAPI.exportHtml({ html, defaultName })
  })

  window.electronAPI.onMenuExportPdf(async () => {
    const tab = getActiveTab()
    if (!tab) return
    const defaultName = tab.filePath
      ? tab.filePath.replace(/\.(md|markdown)$/i, '.pdf')
      : 'document.pdf'
    await window.electronAPI.exportPdf({ defaultName })
  })

  // Keyboard shortcuts for save
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
      e.preventDefault()
      const tab = getActiveTab()
      if (!tab) return
      const content = getEditorContent(editor)
      const result = await window.electronAPI.saveFile({ filePath: tab.filePath, content })
      if (result) {
        tab.filePath = result
        markClean(activeTabId)
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && e.shiftKey) {
      e.preventDefault()
      const tab = getActiveTab()
      if (!tab) return
      const content = getEditorContent(editor)
      const result = await window.electronAPI.saveAs({ content })
      if (result) {
        tab.filePath = result
        markClean(activeTabId)
      }
    }
  })
}

// --- Tab keyboard shortcuts ---
function setupTabShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Tab — next tab
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      cycleTab(1)
    }
    // Ctrl+Shift+Tab — previous tab
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      cycleTab(-1)
    }
  })
}

function cycleTab(direction) {
  const ids = Array.from(tabs.keys())
  if (ids.length <= 1) return
  const currentIndex = ids.indexOf(activeTabId)
  const nextIndex = (currentIndex + direction + ids.length) % ids.length
  activateTab(ids[nextIndex])
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
    // Support dropping multiple files
    for (const file of e.dataTransfer.files) {
      if (/\.(md|markdown|txt)$/i.test(file.name)) {
        const text = await file.text()
        openFileInTab(file.path, text)
      }
    }
  })
}

// --- Export HTML ---
function buildExportHtml(markdownSource) {
  const tab = getActiveTab()
  const renderedBody = renderMarkdown(markdownSource)
  const title = tab && tab.filePath ? tab.filePath.split(/[/\\]/).pop().replace(/\.(md|markdown)$/i, '') : 'Document'
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>' + title + '</title>\n  <style>\n    body { max-width: 800px; margin: 40px auto; padding: 0 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }\n    h1, h2 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; }\n    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: "Consolas", monospace; }\n    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }\n    pre code { background: transparent; padding: 0; }\n    blockquote { border-left: 4px solid #0366d6; padding: 8px 16px; margin: 0 0 1em; color: #666; }\n    table { border-collapse: collapse; width: 100%; }\n    th, td { border: 1px solid #ddd; padding: 8px 12px; }\n    th { background: #f0f0f0; }\n    img { max-width: 100%; }\n  </style>\n</head>\n<body>' + renderedBody + '</body>\n</html>'
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
