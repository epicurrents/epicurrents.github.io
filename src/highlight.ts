/**
 * Syntax highlighting for the fenced code blocks of the documentation pages.
 *
 * Only the languages the pages use are registered, so the bundle does not carry every grammar highlight.js ships.
 * A fence with no language, or one not registered here, is left plain: guessing the language of a short snippet
 * goes wrong often enough to be worse than no colour. Colours come from `highlight.css`.
 */

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
 * Highlight a fenced code block for markdown-it.
 * @param code - The block's content.
 * @param lang - The language named after the opening fence, or an empty string.
 * @returns The highlighted HTML, or an empty string to have markdown-it escape the block as plain text.
 */
export default function highlight (code: string, lang: string) {
    if (!lang || !hljs.getLanguage(lang)) {
        return ''
    }
    try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
        return ''
    }
}
