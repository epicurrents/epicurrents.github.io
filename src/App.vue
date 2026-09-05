<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EpicurrentsLogo from './assets/logo.vue'
import { documentation, type NavigationItem } from './router'
import SearchResults from './components/SearchResults.vue'

type PageProperties = {
    name: string
    path: string
    icon?: string
}
const routePath = ref([{
    name: 'Home',
    path: '/',
    icon: 'house',
}] as PageProperties[])

// Route setup.
const router = useRouter()
const route = useRoute()
let docVersion = 'latest'
router.beforeEach((to, _from, next) => {
    routePath.value.splice(1)
    if (to.path === '/') {
        next()
        return
    } else if (to.path.startsWith('/docs/')) {
        const pathVersion = to.path.match(/^\/docs\/(\d+\.\d+(\.\d+)?|latest)\//)
        /** Documentation version. */
        if (pathVersion) {
            docVersion = pathVersion[1]
        }
        to.meta.version = docVersion
        // Remove the prefix from the path.
        const docPath = to.path.replace(pathVersion ? `/docs/${docVersion}/` : '/docs/', '')
        // Construct route path for breadcrumbs.
        for (const [_section, items] of Object.entries(documentation)) {
            for (const item of items) {
                if (!item.path) {
                    // Skip headers.
                    continue
                }
                if (docPath.startsWith(item.path)) {
                    routePath.value.push({ ...item})
                    if (docPath === item.path) {
                        to.meta.subitems = item.subitems || null
                        break
                    }
                }
                if (docPath.length > item.path.length && item.subitems) {
                    for (const subitem of item.subitems) {
                        if (docPath === subitem.path) {
                            routePath.value.push({ ...subitem})
                        }
                    }
                }
            }
        }
        // Inject previous and next page information.
        // We need to flatten the navigation tree to include child routes.
        const navList = [] as NavigationItem[]
        for (const [_section, items] of Object.entries(documentation)) {
            for (const item of items) {
                navList.push(item)
                if (item.subitems) {
                    navList.push(...item.subitems)
                }
            }
        }
        for (let i=0; i<navList.length; i++) {
            if (navList[i].path === docPath) {
                if (!i) {
                    to.meta.prev = null
                } else {
                    let prevIdx = i - 1
                    // Find the previous item that has a path.
                    while (prevIdx >= 0 && !navList[prevIdx].path) {
                        prevIdx--
                    }
                    if (prevIdx > 0) {
                    to.meta.prev = {
                        name: navList[prevIdx].name,
                        path: pathVersion ? `/docs/${docVersion}/${navList[prevIdx].path}`
                                          : `/docs/${navList[prevIdx].path}`,
                    }
                    }
                }
                if (i < navList.length - 1) {
                    // Find the next item that has a path.
                    let nextIdx = i + 1
                    while (nextIdx < navList.length && !navList[nextIdx].path) {
                        nextIdx++
                    }
                    if (nextIdx < navList.length) {
                        to.meta.next = {
                            name: navList[nextIdx].name,
                            path: pathVersion ? `/docs/${docVersion}/${navList[nextIdx].path}`
                                            : `/docs/${navList[nextIdx].path}`,
                        }
                    }
                } else {
                    to.meta.next = null
                }
            }
        }
        if (routePath.value.length) {
            to.meta.name = routePath.value[routePath.value.length - 1].name
        }
    } else {
        const names = (to.name as string || '').split('/')
        const paths = (to.path as string || '').split('/')
        let path = ''
        for (let i=1; i<paths.length; i++) {
            path +=  '/' + paths[i]
            routePath.value.push({
                name: names[i-1],
                path: path,
            })
        }
    }
    next()
})

/**
 * Get a docs path from the given path, including version if present.
 * @param path - Documentation path.
 */
const docPathFromPath = (path: string) => {
    return route.path.startsWith(`/docs/${docVersion}/`)
           ? `/docs/${docVersion}/${path}`
           : `/docs/${path}`
}

/**
 * Check if the current route matches the given documentation path.
 * @param path - Documentation path.
 */
const isDocPath = (path: string) => {
    const pathRegex = new RegExp(`^\\/docs(\\/${docVersion})?\\/${path}$`)
    return route.path.match(pathRegex)
}
/**
 * Check if the given path is a parent of the current documentation path.
 * @param path - Documentation path.
 */
const isDocParent = (path: string) => {
    const pathRegex = new RegExp(`^\\/docs(\\/${docVersion})?\\/${path}`)
    return route.path.match(pathRegex)
}

const loadDocs = (path: string) => {
    router.push(path)
}

// Collapsible navigation sections.
/** Sections expanded by default; the rest start collapsed. */
const defaultExpandedSections = ['Platform', 'Basic use']
/** Reactive map of section title -> expanded state. */
const expandedSections = reactive<Record<string, boolean>>(
    Object.fromEntries(
        Object.keys(documentation).map(section => [section, defaultExpandedSections.includes(section)])
    )
)

/**
 * Find the nearest scrollable ancestor of an element, crossing shadow DOM
 * boundaries (the navigation lives inside a wa-scroller).
 * @param el - Element to start the search from.
 */
const getScrollParent = (el: Element): HTMLElement => {
    const visit = (current: Node | null): Node | null => {
        if (!current) {
            return null
        }
        const slot = (current as Element).assignedSlot
        if (slot) {
            return slot
        }
        if (current.parentNode instanceof ShadowRoot) {
            return current.parentNode.host
        }
        return current.parentNode
    }
    let node: Node | null = visit(el)
    while (node) {
        if (node instanceof HTMLElement) {
            const overflowY = getComputedStyle(node).overflowY
            if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
                return node
            }
        }
        node = visit(node)
    }
    return (document.scrollingElement as HTMLElement) ?? document.documentElement
}

/**
 * Bring a freshly expanded section into view: reveal the whole section if it
 * fits in the scroller, otherwise align its title with the top of the viewport.
 * @param sectionEl - The `.nav-section` element that was expanded.
 */
const scrollSectionIntoView = (sectionEl: HTMLElement) => {
    const viewport = getScrollParent(sectionEl)
    const vpRect = viewport.getBoundingClientRect()
    const secRect = sectionEl.getBoundingClientRect()
    const vpHeight = viewport.clientHeight
    let delta = 0
    if (secRect.height <= vpHeight) {
        // The whole section fits: scroll the minimum needed to show all of it.
        if (secRect.bottom > vpRect.top + vpHeight) {
            delta = secRect.bottom - (vpRect.top + vpHeight)
        } else if (secRect.top < vpRect.top) {
            delta = secRect.top - vpRect.top
        }
    } else {
        // Section is taller than the viewport: align its title with the top.
        delta = secRect.top - vpRect.top
    }
    if (delta) {
        viewport.scrollBy({ top: delta, behavior: 'smooth' })
    }
}

/**
 * Toggle a navigation section open/closed, scrolling it into view on expand.
 * @param section - Section title.
 * @param ev - Originating click event.
 */
const toggleSection = (section: string, ev: Event) => {
    const expand = !expandedSections[section]
    expandedSections[section] = expand
    if (expand) {
        const sectionEl = (ev.currentTarget as HTMLElement).closest('.nav-section') as HTMLElement | null
        if (sectionEl) {
            nextTick(() => requestAnimationFrame(() => scrollSectionIntoView(sectionEl)))
        }
    }
}

/** Make sure the section containing the active documentation page is expanded. */
const ensureActiveSectionExpanded = () => {
    for (const [section, items] of Object.entries(documentation)) {
        if (items.some(item => !!isDocParent(item.path))) {
            expandedSections[section] = true
        }
    }
}
watch(() => route.path, () => ensureActiveSectionExpanded(), { immediate: true })

// Search
const searchQuery = ref('')
const searchOpen = ref(false)
function onSearchInput(e: Event) {
    searchQuery.value = (e.target as HTMLInputElement).value
    searchOpen.value = true
}
function closeSearch() {
    searchOpen.value = false
}
function onSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeSearch()
}

function onDocClick(e: MouseEvent) {
    const wrap = document.querySelector('.search-wrap')
    if (wrap && !wrap.contains(e.target as Node)) closeSearch()
}
onMounted(() => document.addEventListener('click', onDocClick, true))
onUnmounted(() => document.removeEventListener('click', onDocClick, true))

// Color scheme.
const mode = ref('system' as 'light' | 'dark' | 'system')
/** Icon representing the currently active color mode (shown on the toggle button). */
const modeIcon = computed(() =>
    mode.value === 'light' ? 'sun' : mode.value === 'dark' ? 'moon' : 'display'
)
/** Activate the color mode selected from the mode menu. */
const onModeSelect = (ev: Event) => {
    const value = (ev as CustomEvent).detail?.item?.value
    if (value === 'light' || value === 'dark' || value === 'system') {
        mode.value = value
    }
}
watch(() => mode.value, value => {
    const html = document.querySelector('html')
    if (value === 'light') {
        html?.classList.remove('wa-dark')
    } else if (value === 'dark') {
        html?.classList.add('wa-dark')
    } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            html?.classList.add('wa-dark')
        } else {
            html?.classList.remove('wa-dark')
        }
    }
})

// Handle initial dark mode and mode transitions when using system mode.
if (window.matchMedia) {
    const html = document.querySelector('html')
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html?.classList.add('wa-dark')
    } else {
        html?.classList.remove('wa-dark')
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (mode.value !== 'system') {
            return
        }
        if (event.matches) {
            html?.classList.add('wa-dark')
        } else {
            html?.classList.remove('wa-dark')
        }
    })
}
</script>

<template>
    <wa-page disable-sticky="aside" mobile-breakpoint="960">
        <header slot="header" class="wa-split">
            <div class="left">
                <router-link to="/">
                    <div class="logo">
                        <epicurrents-logo stroke-color="var(--wa-color-text-quiet)" :stroke-width="5" />
                    </div>
                </router-link>
                <div class="title">
                    <div class="main">
                        <router-link to="/">EpiCurrents</router-link>
                    </div>
                    <div class="sub">
                        A JavaScript library for processing and displaying neurophysiological signal data
                    </div>
                </div>
            </div>
            <div class="right">
                <div class="search-wrap">
                    <wa-input
                        id="search"
                        type="search"
                        placeholder="Search"
                        :value="searchQuery"
                        @input="onSearchInput"
                        @keydown="onSearchKeydown"
                        @focus="searchOpen = true"
                    >
                        <wa-icon name="search" slot="start"></wa-icon>
                    </wa-input>
                    <search-results
                        v-if="searchOpen"
                        :query="searchQuery"
                        @close="closeSearch"
                    ></search-results>
                </div>
                <wa-dropdown class="mode" placement="bottom-end" @wa-select="onModeSelect">
                    <wa-button id="mode-toggle" slot="trigger" appearance="outlined">
                        <wa-icon :name="modeIcon" variant="regular"></wa-icon>
                    </wa-button>
                    <wa-dropdown-item value="light">
                        <wa-icon slot="icon" name="sun" variant="regular"></wa-icon>
                        Light
                        <wa-icon v-if="mode === 'light'" slot="details" name="check"></wa-icon>
                    </wa-dropdown-item>
                    <wa-dropdown-item value="dark">
                        <wa-icon slot="icon" name="moon" variant="regular"></wa-icon>
                        Dark
                        <wa-icon v-if="mode === 'dark'" slot="details" name="check"></wa-icon>
                    </wa-dropdown-item>
                    <wa-dropdown-item value="system">
                        <wa-icon slot="icon" name="display" variant="regular"></wa-icon>
                        System
                        <wa-icon v-if="mode === 'system'" slot="details" name="check"></wa-icon>
                    </wa-dropdown-item>
                </wa-dropdown>
                <wa-tooltip for="mode-toggle" placement="bottom">Color mode</wa-tooltip>
            </div>
        </header>
        <nav slot="subheader">
            <wa-breadcrumb>
                <wa-breadcrumb-item v-for="(item, idx) in routePath" :key="`breadcrumb-${idx}`">
                    <router-link :to="idx && route.path.startsWith('/docs/') ? docPathFromPath(item.path) : item.path">
                        <wa-icon v-if="item.icon" :name="item.icon" family="duotone"></wa-icon>
                        <span v-else>{{ item.name }}</span>
                    </router-link>
                </wa-breadcrumb-item>
            </wa-breadcrumb>
        </nav>
        <nav slot="navigation-header">
            Navigation
        </nav>
        <nav slot="navigation">
            <wa-scroller orientation="vertical">
                <template v-for="([section, items], idx) in Object.entries(documentation)" :key="`nav-${idx}`">
                    <wa-divider v-if="idx"></wa-divider>
                    <div class="nav-section" :data-section="section">
                        <button
                            type="button"
                            class="section"
                            :aria-expanded="expandedSections[section] ? 'true' : 'false'"
                            @click="toggleSection(section, $event)"
                        >
                            <span>{{ section }}</span>
                            <wa-icon
                                class="section-toggle"
                                :name="expandedSections[section] ? 'minus' : 'plus'"
                                variant="regular"
                            ></wa-icon>
                        </button>
                        <wa-tree
                            v-show="expandedSections[section]"
                            @wa-selection-change="loadDocs($event.detail.selection[0].dataset.path)"
                        >
                            <wa-tree-item v-for="(item, idy) of items" :key="`nav-${idx}-${idy}`"
                                :expanded="isDocParent(item.path) ? true : undefined"
                                :selected="isDocPath(item.path) ? true : undefined"
                                :data-path="docPathFromPath(item.path)"
                            >
                                {{ item.name }}
                                <wa-tree-item v-for="(subitem, idy) in (item.subitems || [])" :key="`nav-${idx}-${idy}`"
                                    :selected="isDocPath(subitem.path) ? true : undefined"
                                    style="--indent-size: 1rem"
                                    :data-path="docPathFromPath(subitem.path)"
                                >
                                    {{ subitem.name.split('/').pop() }}
                                </wa-tree-item>
                            </wa-tree-item>
                        </wa-tree>
                    </div>
                </template>
            </wa-scroller>
        </nav>
        <nav slot="navigation-footer">
            <ul>
                <li>
                    <router-link to="/about">
                        <wa-icon name="circle-info" variant="light"></wa-icon>
                        About
                    </router-link>
                </li>
                <li>
                    <router-link to="/license">
                        <wa-icon name="file-certificate" variant="light"></wa-icon>
                        License
                    </router-link>
                </li>
                <li>
                    <a href="https://epicurrents.io" target="_blank">
                        <wa-icon name="arrow-up-right-from-square" variant="light"></wa-icon>
                        Website
                    </a>
                </li>
                <li>
                    <a href="https://demo.epicurrents.io/viewer/public" target="_blank">
                        <wa-icon name="desktop" variant="light"></wa-icon>
                        Demo
                    </a>
                </li>
            </ul>
        </nav>
        <router-view></router-view>
        <aside id="docs-toc" slot="aside" class="conditional table-of-contents wa-desktop-only">
            <!-- This will be dynamically populated from the docs component. -->
        </aside>
        <aside slot="aside" class="social-links wa-desktop-only">
            <ul>
                <li>
                    <a href="https://github.com/epicurrents" target="_blank">
                        <wa-icon name="github" family="brands" slot="prefix"></wa-icon>
                        GitHub repository
                    </a>
                </li>
            </ul>
        </aside>
    </wa-page>
</template>

<style>
wa-page {
    --menu-width: 15rem;
    --aside-width: 20rem;
    color: var(--wa-color-text-normal);
}
wa-page[view='desktop'] {
    [slot*='navigation'] {
        border-inline-end: var(--wa-border-width-s) var(--wa-border-style) var(--wa-color-surface-border);
    }
}
wa-page[view='mobile'] {
    --menu-width: auto;
    --aside-width: auto;
}
wa-page[view='mobile']::part(navigation-toggle) {
    background-color: var(--wa-color-surface-default);
    border-radius: 0.5rem;
    border: solid 1px var(--wa-color-neutral-border-normal);
    cursor: pointer;
    left: 0;
    margin-inline-start: 0.5rem;
    padding: 0;
    position: absolute;
    top: 0.5rem;
}
[slot='banner'] {
    --wa-color-text-link: var(--wa-color-neutral-on-loud);
    background-color: var(--wa-color-neutral-fill-loud);
}
[slot='header'] {
    --wa-link-decoration-default: none;
    border-block-end: var(--wa-border-width-s) var(--wa-border-style) var(--wa-color-surface-border);
}
[slot='header'] .left {
    display: flex;
    min-inline-size: 0;
}
    [slot='header'] .left > a {
        flex-shrink: 0;
    }
    [slot='header'] .logo {
        aspect-ratio: 1;
        display: inline-block;
        height: 4.5rem;
        overflow: hidden;
        padding: 0.5rem;
        border-radius: 0.5rem;
        border: solid 1px var(--wa-color-brand-border-normal);
    }
        .logo svg {
            height: 100%;
            color: var(--wa-color-text-normal);
        }
    [slot='header'] .title {
        min-block-size: 4.5rem;
        padding-left: 1rem;
        font-variant: small-caps;
    }
        [slot='header'] .title .main {
            height: 2.75rem;
            line-height: 2.75rem;
            font-size: 1.875rem;
            font-weight: 700;
            color: var(--wa-color-brand-on-normal);
        }
        [slot='header'] .title .sub {
            color: var(--wa-color-text-quiet);
            line-height: 1.1rem;
            min-block-size: 1.75rem;
        }
    [slot='header'] .right {
        display: flex;
        flex-direction: row;
        align-items: center;
        align-self: flex-start;
        gap: 0.5rem;
        flex-shrink: 0;
        margin-inline-start: auto;
    }
        [slot='header'] .right .search-wrap {
            position: relative;
        }
        [slot='header'] .right .search-wrap wa-input[type='search'] {
            inline-size: 18rem;
            max-inline-size: 100%;
        }
[slot*='header'] a {
    font-weight: var(--wa-font-weight-action);
}
#search::part(base) {
    padding: 0 0.75rem;
}
    #search wa-icon {
        margin-inline-end: 0.75rem;
    }
[slot='subheader'] {
    background-color: var(--wa-color-surface-lowered);
    border-block-end: var(--wa-border-width-s) var(--wa-border-style) var(--wa-color-surface-border);
}
    [slot='subheader'] a {
        color: var(--wa-color-brand-on-normal);
    }
    [slot='subheader'] a:hover {
        color: var(--wa-color-text-link);
    }
wa-page::part(navigation-header) {
    padding-block: 0.5rem;
}
[slot='navigation-header'] {
    display: block;
    border-block-end: var(--wa-border-width-s) var(--wa-border-style) var(--wa-color-surface-border);
    font-weight: 700;
    color: var(--wa-color-brand-on-normal);
    padding: var(--wa-space-s) var(--wa-space-m);
}
    [slot='navigation-header'] wa-icon {
        margin-inline-end: 0.25rem;
        vertical-align: middle;
    }
[slot='navigation'] {
    padding: 0.5rem 0;
}
[slot='navigation'] wa-divider {
    margin: 0.5rem 0;
}
[slot='navigation'] wa-menu-label {
    padding-left: 1rem;
    font-size: 1rem;
    font-weight: 700;
}
wa-page::part(navigation-footer) {
    padding-block: 0.5rem;
}
[slot='navigation-footer'] {
    border-block-start: var(--wa-border-width-s) var(--wa-border-style) var(--wa-color-surface-border);
    padding: 0.5rem 0;
    .wa-flank {
        --flank-size: 1.25em;
    }
}
[slot='main-header'],
main,
[slot='main-footer'] {
    max-inline-size: 60rem;
    margin-inline: auto;
}
main {
    padding: 0;
}
main.content {
    padding: 0 2rem;
}
[slot='main-footer'] {
    border-block-start: var(--wa-border-width-s) var(--wa-border-style) var(--wa-color-surface-border);
}
[slot='footer'] {
    --wa-color-text-link: var(--wa-color-text-quiet);
    background-color: var(--wa-color-surface-lowered);
    font-size: var(--wa-font-size-s);
    padding: 1rem;
}
/* Element styles */
a {
    color: inherit;
    text-decoration: none;
}
    a:hover {
        color: var(--wa-color-text-link);
    }
    a > wa-icon {
        vertical-align: top;
        position: relative;
        top: 0.25em;
    }
aside {
    margin-block-start: 1.5rem;
    padding: 0 1rem;
    position: relative;
}
aside.conditional {
    display: none;
}
aside.wa-desktop-only {
    padding-left: 0;
}
aside > ul,
nav ul {
    padding: 0;
    text-align: left;
    list-style-type: none;
}
nav ul {
    margin: 0;
}
aside > ul {
    margin-block-end: 0;
    margin-block-start: 0;
    margin-inline-end: 0;
    margin-inline-start: 0;
}
aside > ul li,
nav li {
    padding: 0.125rem 1rem;
}
aside > ul {
    padding: 1rem 0 0.75rem 0;
    border-radius: 0.5rem;
    border: solid 1px var(--wa-color-neutral-border-normal);
}
aside > ul::before {
    position: absolute;
    top: -0.75rem;
    left: 0.5rem;
    font-weight: 700;
    color: var(--wa-color-brand-on-normal);
    background-color: var(--wa-color-surface-default);
    display: block;
    padding: 0 0.5rem;
}
nav .nav-section .section {
    align-items: center;
    background: none;
    border: none;
    color: var(--wa-color-brand-on-normal);
    cursor: pointer;
    display: flex;
    font: inherit;
    font-weight: 700;
    inline-size: 100%;
    justify-content: space-between;
    padding: 0.25rem 1rem;
    text-align: start;
}
    nav button.section {
        height: 2rem;
    }
    nav .nav-section .section:hover {
        color: var(--wa-color-text-link);
    }
    nav .nav-section .section .section-toggle {
        color: var(--wa-color-brand-on-quiet);
        font-size: 0.85em;
        margin-inline-start: 0.5rem;
    }
nav wa-tree-item::part(indentation) {
    margin-inline-end: 0.25rem;
}
nav wa-tree-item::part(item) {
    cursor: pointer;
}
nav wa-tree-item::part(expand-button) {
    color: var(--wa-color-brand-on-quiet);
}
h1, h2, h3, h4, h5, h6 {
    color: var(--wa-color-brand-on-normal);
}
li wa-icon {
    margin-inline-end: 0.5rem;
}
nav li a {
    display: block;
}
nav li a {
    display: block;
}
nav[slot='navigation-footer'] li {
    margin-inline-start: 0;
}
li.title {
    font-weight: 700;
    color: var(--wa-color-brand-on-normal);
}
/**********************
    CONTENT STYLES
***********************/
.content h1 {
    font-size: 2rem;
    font-variant: small-caps;
    margin-block-start: 1.5rem;
    margin-block-end: 1.5rem;
}
.content h2 {
    border-bottom: solid 1px var(--wa-color-brand-border-normal);
    font-size: 1.5rem;
    margin-block-start: 1rem;
    margin-block-end: 1rem;
}
.content h3 {
    font-size: 1.2rem;
    margin: 0.75rem 0;
}
.content h4 {
    font-size: 1rem;
    font-weight: bold;
    margin: 0.5rem 0;
}
.content a {
    color: var(--wa-color-text-link);
}
.content blockquote {
    margin: 1em 0;
    padding: 0.5em 1em;
    font-family: inherit;
    font-size: 1.125em;
    border-left: solid 0.25em var(--wa-color-brand-on-quiet);
    background-color: var(--wa-color-brand-fill-quiet);
    border-radius: 0.2rem 0.5em 0.5em 0.2rem;
}
.content code:not(.license) {
    display: inline-block;
    font-size: 0.85em;
    background-color: var(--wa-color-neutral-fill-quiet);
    padding: 0 0.33em;
    border-radius: 0.25em;
}
.content img {
    max-width: 100%;
    object-fit: scale-down;
    vertical-align: middle;
}
.content p {
    margin: 1rem 0;
}
.table-of-contents > ul::before {
    content: 'Table of contents';
}
.social-links > ul::before {
    content: 'Social links';
}
.table-of-contents > ul {
    list-style-type: none;
    border: solid 1px var(--wa-color-neutral-border-normal);
    border-radius: 0.5em;
    padding: 1rem 0 0.75rem 0;
}
    .table-of-contents ul li {
        padding: 0;
        margin: 0;
    }
    .table-of-contents ul > li > a {
        display: block;
        margin: 0.25rem 0;
        padding: 0;
    }
    .table-of-contents > ul > li > a {
        /* Apply padding to the first level links */
        padding: 0 1rem;
    }
    /* Nested TOC */
    .table-of-contents ul ul {
        margin-inline-start: 0;
        padding: 0;
    }
    .table-of-contents ul ul li {
        display: block;
        padding-left: 2.75rem;
    }
    .table-of-contents ul ul li::before {
        content: '⚬';
        position: absolute;
        left: 1.5rem;
        color: var(--wa-color-text-quiet);
    }
</style>
