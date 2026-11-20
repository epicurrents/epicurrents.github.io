/**
 * Syntax highlighting for the fenced code blocks of the documentation pages.
 *
 * Only the languages the pages use are registered, so the bundle does not carry every grammar highlight.js ships.
 * A fence with no language, or one not registered here, is left plain: guessing the language of a short snippet
 * goes wrong often enough to be worse than no colour. A block that names a language is also wrapped in an element
 * carrying its display name, which `highlight.css` draws as a label in the block's corner. The label is outside the
 * `pre`, so it stays put when a long line scrolls the block, and it is drawn by CSS, so copying the code leaves it out.
 */

import type MarkdownIt from 'markdown-it'

import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import ini from 'highlight.js/lib/languages/ini'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import './highlight.css'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('ini', ini)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)
// highlight.js has no grammar of its own for these; the closest one reads them well enough.
hljs.registerAliases(['dotenv', 'env'], { languageName: 'ini' })
hljs.registerAliases(['vue'], { languageName: 'xml' })

/**
 * Display names for the labels, by fence language. highlight.js has names of its own, but they describe the
 * grammar a block is read with, which for `dotenv` and `vue` is not what the block is.
 */
const LABELS: Record<string, string> = {
    bash: 'Shell',
    dotenv: '.env',
    javascript: 'JavaScript',
    js: 'JavaScript',
    json: 'JSON',
    python: 'Python',
    sh: 'Shell',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    vue: 'Vue',
    yaml: 'YAML',
}

/**
 * Highlight a fenced code block for markdown-it.
 * @param code - The block's content.
 * @param lang - The language named after the opening fence, or an empty string.
 * @returns The highlighted HTML, or an empty string to have markdown-it escape the block as plain text.
 */
function highlight (code: string, lang: string) {
    if (!lang || !hljs.getLanguage(lang)) {
        return ''
    }
    try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
        return ''
    }
}

/**
 * Highlight the fenced code blocks of `md` and label each one that names a language.
 * @param md - The markdown-it instance the pages are rendered with.
 */
export default function codeBlocks (md: MarkdownIt) {
    md.set({ highlight })
    const fence = md.renderer.rules.fence!
    md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const html = fence(tokens, idx, options, env, self)
        const lang = tokens[idx].info.trim().split(/\s+/)[0]
        if (!lang) {
            return html
        }
        const label = md.utils.escapeHtml(LABELS[lang] ?? lang)
        return `<div class="code-block" data-lang="${label}">${html}</div>`
    }
}
