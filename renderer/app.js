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
      document.getElementById('status-cursor').textContent = 'Ln ' + line + ', Col ' + col
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
  document.getElementById('hljs-light').disabled = dark
  document.getElementById('hljs-dark').disabled = !dark
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
  const title = fileName + dirtyMarker + ' - MarkdownEdit'
  document.title = title
  window.electronAPI.updateTitle(title)
  document.getElementById('status-file').textContent = currentFilePath || 'Untitled'
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
  const title = currentFilePath ? currentFilePath.split(/[/\\]/).pop().replace(/\.(md|markdown)$/i, '') : 'Document'
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
