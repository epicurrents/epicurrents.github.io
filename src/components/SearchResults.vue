<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { search, loadIndex, type SearchResult } from '../search'
import { documentation } from '../router'

const props = defineProps<{ query: string }>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const results = ref<SearchResult[]>([])
const pending = ref(false)

// Build a flat path → page name map from the navigation tree.
const pageNames: Record<string, string> = {}
for (const items of Object.values(documentation)) {
    for (const item of items) {
        pageNames[item.path] = item.name
        for (const sub of item.subitems ?? []) {
            pageNames[sub.path] = sub.name
        }
    }
}

function pageTitle(path: string): string {
    return pageNames[path] ?? path.split('/').pop() ?? path
}

watch(() => props.query, async (q) => {
    if (!q.trim()) { results.value = []; return }
    pending.value = true
    results.value = await search(q)
    pending.value = false
}, { immediate: true })

function go(result: SearchResult) {
    const base = `/docs/${result.path}`
    const target = result.anchor ? `${base}#${result.anchor}` : base
    router.push(target)
    emit('close')
}

// Position the overlay just below the search input using its actual viewport rect.
const top = ref('4rem')
const right = ref('1rem')

function updatePosition() {
    const wrap = document.querySelector('.search-wrap')
    if (wrap) {
        const rect = wrap.getBoundingClientRect()
        top.value = `${rect.bottom + 4}px`
        right.value = `${document.documentElement.clientWidth - rect.right}px`
    }
}

onMounted(async () => {
    await nextTick()
    updatePosition()
    window.addEventListener('resize', updatePosition)
})

onUnmounted(() => {
    window.removeEventListener('resize', updatePosition)
})

// Pre-warm the index when component mounts.
loadIndex()
</script>

<template>
    <Teleport to="body">
        <div
            v-if="query.trim()"
            class="search-results"
            :style="{ top, right }"
        >
            <div
                v-if="pending"
                class="search-empty"
            >
                <wa-spinner></wa-spinner>
            </div>
            <div
                v-else-if="results.length === 0"
                class="search-empty"
            >
                No results for <strong>{{ query }}</strong>
            </div>
            <ul v-else>
                <li
                    v-for="result in results"
                    :key="result.id"
                    class="search-item"
                    tabindex="0"
                    @click="go(result)"
                    @keydown.enter="go(result)"
                >
                    <div class="search-item-title">
                        <span class="search-page">{{ pageTitle(result.path) }}</span>
                        <span
                            v-if="result.heading"
                            class="search-section"
                        >
                            <wa-icon name="angle-right" variant="regular"></wa-icon>
                            {{ result.heading }}
                        </span>
                    </div>
                    <div class="search-item-excerpt">{{ result.excerpt }}</div>
                </li>
            </ul>
        </div>
    </Teleport>
</template>

<style scoped>
.search-results {
    background-color: var(--wa-color-surface-raised);
    border: var(--wa-border-width-s) var(--wa-border-style) var(--wa-color-surface-border);
    border-radius: var(--wa-border-radius-m);
    box-shadow: var(--wa-shadow-l);
    max-block-size: 24rem;
    overflow-y: auto;
    position: fixed;
    inline-size: min(32rem, calc(100vw - 2rem));
    z-index: 9999;
}
.search-empty {
    color: var(--wa-color-text-quiet);
    font-size: var(--wa-font-size-s);
    padding: 0.75rem 1rem;
    text-align: center;
}
ul {
    list-style: none;
    margin: 0;
    padding: 0.25rem 0;
}
    ul li {
        margin-inline-start: 0;
        padding: 0.25rem 1rem;
    }
.search-item {
    cursor: pointer;
    padding: 0.5rem 1rem;
}
.search-item:hover,
.search-item:focus {
    background-color: var(--wa-color-neutral-fill-quiet);
    outline: none;
}
.search-item-title {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    font-size: var(--wa-font-size-s);
    font-weight: var(--wa-font-weight-semibold);
    gap: 0.25rem;
}
.search-page {
    color: var(--wa-color-brand-on-normal);
}
.search-section {
    align-items: center;
    color: var(--wa-color-text-normal);
    display: flex;
    font-weight: var(--wa-font-weight-normal);
    gap: 0.2rem;
}
.search-section wa-icon {
    color: var(--wa-color-text-quiet);
    font-size: 0.7em;
}
.search-item-excerpt {
    color: var(--wa-color-text-quiet);
    font-size: var(--wa-font-size-xs);
    margin-block-start: 0.2rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
