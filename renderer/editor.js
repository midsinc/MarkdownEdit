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
  '.cm-activeLine': { backgroundColor: '#31324440' },
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
