import type { Plugin } from 'vite'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** Strip markdown syntax, returning plain searchable text. */
function stripMarkdown(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`\n]+`/g, ' ')
        .replace(/!\[.*?\]\(.*?\)/g, ' ')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[\[toc\]\]/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[*_]{1,2}([^*_\n]+)[*_]{1,2}/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, ' ')
        .replace(/^\s*>\s+/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function collectMdFiles(dir: string): string[] {
    const results: string[] = []
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
            results.push(...collectMdFiles(full))
        } else if (entry.endsWith('.md')) {
            results.push(full)
        }
    }
    return results
}

export interface SearchDocument {
    id: string
    path: string
    heading: string
    anchor: string
    body: string
}

function buildDocuments(docsDir: string): SearchDocument[] {
    const files = collectMdFiles(docsDir)
    const documents: SearchDocument[] = []
    let idCounter = 0

    for (const file of files) {
        const routePath = relative(docsDir, file)
            .replace(/\.md$/, '')
            .replace(/\\/g, '/')
        const raw = readFileSync(file, 'utf-8')

        // Split on ## (or deeper) headings, keeping the heading on each section.
        const sections = raw.split(/(?=^#{2,6}\s)/m)

        for (const section of sections) {
            const headingMatch = section.match(/^(#{2,6})\s+(.+)/)
            const heading = headingMatch ? headingMatch[2].trim() : ''
            const anchor = heading
                ? heading.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
                : ''
            const body = stripMarkdown(section)

            if (!body.trim()) continue

            documents.push({
                id: String(idCounter++),
                path: routePath,
                heading,
                anchor,
                body: body.slice(0, 500),
            })
        }
    }

    return documents
}

export function searchIndexPlugin(): Plugin {
    const docsDir = 'src/docs/latest'
    const outputFile = 'public/search-index.json'

    function generate() {
        try {
            const docs = buildDocuments(docsDir)
            writeFileSync(outputFile, JSON.stringify(docs))
        } catch (e) {
            console.error('[search-index]', e)
        }
    }

    return {
        name: 'search-index',
        buildStart() {
            generate()
        },
        configureServer(server) {
            generate()
            server.watcher.on('change', (path) => {
                if (path.includes('/docs/') && path.endsWith('.md')) generate()
            })
            server.watcher.on('add', (path) => {
                if (path.includes('/docs/') && path.endsWith('.md')) generate()
            })
        },
    }
}
