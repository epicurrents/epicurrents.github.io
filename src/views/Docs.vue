<script setup lang="ts">
import { onUnmounted, ref, watch, type PropType } from 'vue'
import { onMounted } from 'vue'
import markdownit from 'markdown-it'
import anchor from 'markdown-it-anchor'
import footnote from 'markdown-it-footnote'
import toc from 'markdown-it-table-of-contents'
import { useRoute } from 'vue-router'

const route = useRoute()
const md = markdownit()
md.use(anchor)
md.use(footnote, {
    // Enable footnotes in the documentation.
    inline: true,
})
md.use(toc, {
    // We don't use first level header in the MD files, that is reserved for the page title.
    includeLevel: [2, 3],
    transformLink: (link: string) => {
        // Hash history mode requires a custom link.
        // Using these links is saved to the browser route history.
        return route.path + '#' + link
    },
})

const props = defineProps({
    /** Documentation file path. */
    path: {
        type: Array as PropType<string[]>,
        required: true,
    },
})
/** Rendered document content. */
const content = ref('')
/** A recursive list of markdown files under the docs directory. */
// This has to list all supported versions, because glob requires a literal path.
const docs = route.meta.version === '0.3'
           ? import.meta.glob(`../docs/0.3/**/*.md`)
           : import.meta.glob(`../docs/latest/**/*.md`)
/** Is the document still loading. */
const isLoading = ref(true)
/**
 * Load the document at the given path.
 * @param path - Path to the document as an array of folder/file names.
 */
const loadDoc = async (path: string[]) => {
    const isVersioned = path[0] === route.meta.version
    const docPath = isVersioned
                  ? `../docs/${path.join('/')}.md`
                  : `../docs/${route.meta.version}/${path.join('/')}.md`
    if (docPath in docs) {
        const docMd = await (await fetch(new URL(docPath, import.meta.url))).text()
        // Perform custom formatting.
            // Docs links versioning.
        const docFinal = docMd.replace(
                /\(docs\//g,
                isVersioned ? `(/#/docs/${route.meta.version}/`
                            : `(/#/docs/`
            )
        const rendered = md.render(docFinal)
        content.value = rendered
            // Add inline SVG icons.
            .replace(
                /\[\[icon:([^\]]+)\]\]/g,
                `<wa-icon name="$1" variant="regular"></wa-icon>`
            )
        isLoading.value = false
        requestAnimationFrame(() => {
            // Move the TOC to the aside element if we're on desktop.
            const toc = document.querySelector('.doc > .table-of-contents') as HTMLElement
            const aside = document.querySelector('aside#docs-toc') as HTMLElement
            if (toc && aside) {
                toc.classList.add('wa-mobile-only')
                aside.style.display = 'block'
                aside.innerHTML = toc.innerHTML
            }
        })
    } else {
        content.value = `<h2>Not found</h2><p>The requested document could not be found.</p>`
        isLoading.value = false
    }
}
watch(() => props.path, (value) => {
    loadDoc(value)
})
onMounted(async () => {
    loadDoc(props.path)
})
onUnmounted(() => {
    // Clear the content when the component is unmounted.
    content.value = ''
    isLoading.value = true
    const aside = document.querySelector('aside#docs-toc') as HTMLElement
    if (aside) {
        aside.style.display = 'none'
        aside.innerHTML = ''
    }
})
</script>

<template>
    <main class="content">
        <h1>{{ route.meta.name }} <wa-spinner v-if="isLoading"></wa-spinner></h1>
        <wa-details v-if="route.meta.subitems" class="subsections" summary="Sub-sections">
            <ul>
                <li v-for="subitem in route.meta.subitems">
                    <router-link :to="subitem.path">
                        <wa-icon name="arrow-turn-down-right" variant="regular"></wa-icon>
                        {{ subitem.name }}
                    </router-link>
                </li>
            </ul>
        </wa-details>
        <div class="doc" v-html="content"></div>
        <div class="nav">
            <router-link v-if="route.meta.prev" :to="route.meta.prev.path" class="prev">
                ← {{ route.meta.prev.name }}
            </router-link>
            <span v-else><!-- Empty element for flex -->&nbsp;</span>
            <router-link v-if="route.meta.next" :to="route.meta.next.path" class="next">
                {{ route.meta.next.name }} →
            </router-link>
        </div>
    </main>
</template>

<style scoped>
h1 wa-spinner {
    position: relative;
    top: 0.125em;
    left: 0.25em;
}
.subsections {
    margin-bottom: 2rem;
}
.subsections::part(summary) {
    font-weight: 700;
    color: var(--wa-color-brand-on-normal);
}
.subsections::part(content) {
    padding: 0;
}
.subsections wa-icon {
    margin-inline-start: 0.5em;
}
.subsections ul {
    list-style-type: none;
    padding: 0;
    margin-bottom: 0.5rem;
}
.doc:deep(div.table-of-contents > ul) {
    position: relative;
    margin-block-end: 0;
    margin-block-start: 1.5rem;
    margin-inline-end: 0;
    margin-inline-start: 0;
}
.doc:deep(div.table-of-contents > ul::before) {
    position: absolute;
    top: -0.75rem;
    left: 0.5rem;
    font-weight: 700;
    color: var(--wa-color-brand-on-normal);
    background-color: var(--wa-color-surface-default);
    display: block;
    padding: 0 0.5rem;
}
    .doc:deep(.table-of-contents > ul a) {
        color: var(--wa-color-text-normal);
    }
        .doc:deep(.table-of-contents > ul > li > a:hover),
        .doc:deep(.table-of-contents > ul ul > li:hover) {
            background-color: var(--wa-color-neutral-fill-quiet);
        }
.doc :deep(wa-icon) {
    position: relative;
    top: 0.125em;
    margin-inline-end: 0;
}
.nav {
    display: flex;
    justify-content: space-between;
    margin: 1.5rem 0;
    padding-top: 1rem;
    border-top: 1px solid var(--wa-color-neutral-border-normal);
}
</style>
