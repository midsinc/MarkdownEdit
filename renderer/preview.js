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
        return '<pre class="hljs"><code class="language-' + lang + '">' + highlighted + '</code></pre>'
      } catch (_) { /* fall through */ }
    }
    const escaped = md.utils.escapeHtml(str)
    return '<pre class="hljs"><code>' + escaped + '</code></pre>'
  }
})

export function renderMarkdown(source) {
  return md.render(source || '')
}
