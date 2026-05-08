import MiniSearch from 'minisearch'
import type { SearchDocument } from './searchIndexPlugin'

export interface SearchResult {
    id: string
    path: string
    heading: string
    anchor: string
    excerpt: string
    score: number
}

let miniSearch: MiniSearch | null = null
let loading = false
let documents: SearchDocument[] = []

async function loadIndex(): Promise<void> {
    if (miniSearch || loading) return
    loading = true
    try {
        const response = await fetch('/search-index.json')
        documents = await response.json() as SearchDocument[]
        miniSearch = new MiniSearch<SearchDocument>({
            fields: ['heading', 'body'],
            storeFields: ['path', 'heading', 'anchor', 'body'],
            searchOptions: {
                boost: { heading: 3 },
                fuzzy: 0.15,
                prefix: true,
            },
        })
        miniSearch.addAll(documents)
    } finally {
        loading = false
    }
}

function excerpt(body: string, terms: string[]): string {
    const lower = body.toLowerCase()
    let pos = 0
    for (const term of terms) {
        const idx = lower.indexOf(term.toLowerCase())
        if (idx !== -1) { pos = idx; break }
    }
    const start = Math.max(0, pos - 40)
    const end = Math.min(body.length, pos + 120)
    return (start > 0 ? '…' : '') + body.slice(start, end).trim() + (end < body.length ? '…' : '')
}

export async function search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return []
    await loadIndex()
    if (!miniSearch) return []
    const raw = miniSearch.search(query)
    return raw.slice(0, 8).map(r => ({
        id: r.id as string,
        path: r.path as string,
        heading: r.heading as string,
        anchor: r.anchor as string,
        excerpt: excerpt(r.body as string, r.terms),
        score: r.score,
    }))
}

export { loadIndex }
