<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EpicurrentsLogo from './assets/logo.vue'
import { documentation, type NavigationItem } from './router'

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
        // Remove the prefixx from the path.
        const docPath = to.path.replace(pathVersion ? `/docs/${docVersion}/` : '/docs/', '')
        // Construct route path for breadcrumbs.
        for (const item of documentation) {
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
        // Inject previous and next page information.
        // We need to flatten the navigation tree to include child routes.
        const navList = [] as NavigationItem[]
        for (const item of documentation) {
            navList.push(item)
            if (item.subitems) {
                navList.push(...item.subitems)
            }
        }
        for (let i=0; i<navList.length; i++) {
            if (navList[i].path === docPath) {
                if (!i) {
                    to.meta.prev = null
                } else {
                    to.meta.prev = {
                        name: navList[i-1].name,
                        path: pathVersion ? `/docs/${docVersion}/${navList[i-1].path}`
                                          : `/docs/${navList[i-1].path}`,
                    }
                }
                if (i < navList.length - 1) {
                    to.meta.next = {
                        name: navList[i+1].name,
                        path: pathVersion ? `/docs/${docVersion}/${navList[i+1].path}`
                                          : `/docs/${navList[i+1].path}`,
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

// Color scheme.
const mode = ref('system' as 'light' | 'dark' | 'system')
watch(() => mode.value, value => {
    console.log(value)
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
    <wa-page disable-sticky="aside" mobile-breakpoint="920">
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
                <wa-input type="search" placeholder="Search" disabled>
                    <wa-icon name="search" slot="prefix"></wa-icon>
                </wa-input>
                <div class="mode">
                    <div>Mode</div>
                    <wa-radio-group
                        name="mode"
                        orientation="horizontal"
                        value="system"
                        @input="mode = $event.target.value"
                    >
                        <wa-radio-button value="light">
                            <wa-icon id="mode-light" name="sun" variant="regular"></wa-icon>
                            <wa-tooltip for="mode-light">Light</wa-tooltip>
                        </wa-radio-button>
                        <wa-radio-button value="dark">
                            <wa-icon id="mode-dark" name="moon" variant="regular"></wa-icon>
                            <wa-tooltip for="mode-dark">Dark</wa-tooltip>
                        </wa-radio-button>
                        <wa-radio-button value="system">
                            <wa-icon id="mode-system" name="circle-half-stroke" variant="regular"></wa-icon>
                            <wa-tooltip for="mode-system">System</wa-tooltip>
                        </wa-radio-button>
                    </wa-radio-group>
                </div>
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
            <wa-tree @wa-selection-change="loadDocs($event.detail.selection[0].dataset.path)">
                <template v-for="(item, idx) in documentation" :key="`nav-${idx}`">
                    <wa-divider v-if="idx && !item.path"></wa-divider>
                    <wa-menu-label v-if="!item.path" :key="`nav-label-${idx}`">
                        {{ item.name }}
                    </wa-menu-label>
                    <wa-tree-item v-else :key="`nav-${idx}`"
                        :expanded="isDocParent(item.path) ? true : undefined"
                        :selected="isDocPath(item.path) ? true : undefined"
                        :data-path="docPathFromPath(item.path)"
                    >
                        {{ item.name }}
                        <wa-tree-item v-for="(subitem, idy) in (item.subitems || [])" :key="`nav-${idx}-${idy}`"
                            :selected="isDocPath(subitem.path) ? true : undefined"
                            :data-path="docPathFromPath(subitem.path)"
                        >
                            {{ subitem.name.split('/').pop() }}
                        </wa-tree-item>
                    </wa-tree-item>
                </template>
            </wa-tree>
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
                    <a href="https://alpha.epicurrents.io/" target="_blank">
                        <wa-icon name="desktop" variant="light"></wa-icon>
                        Demo
                    </a>
                </li>
            </ul>
        </nav>
        <main>
            <router-view></router-view>
        </main>
        <aside slot="aside" class="wa-desktop-only">
            <ul>
                <li class="title">Development</li>
                <li>
                    <a href="https://github.com/epicurrents" target="_blank">
                        <wa-icon name="github" family="brands" slot="prefix"></wa-icon>
                        GitHub
                    </a>
                </li>
            </ul>
        </aside>
        <footer slot="footer">
            <p>&copy; 2025 Epicurrents</p>
        </footer>
    </wa-page>
</template>

<style>
wa-page {
    --menu-width: 15rem;
    --aside-width: 15rem;
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
    position: absolute;
    top: 0.5rem;
    left: 0;
    padding-right: 0.25rem;
    background-color: var(--wa-color-surface-default);
    cursor: pointer;
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
}
    [slot='header'] .logo {
        display: inline-block;
        height: 5rem;
        padding: 0.5rem;
        border-radius: 0.5rem;
        border: solid 1px var(--wa-color-brand-border-normal);
    }
        .logo svg {
            height: 100%;
            color: var(--wa-color-text-normal);
        }
    [slot='header'] .title {
        height: 6rem;
        padding-left: 1rem;
        font-variant: small-caps;
    }
        [slot='header'] .title .main {
            height: 4rem;
            line-height: 4.5rem;
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--wa-color-brand-on-normal);
        }
        [slot='header'] .title .sub {
            height: 2rem;
            line-height: 1rem;
            color: var(--wa-color-text-quiet);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    [slot='header'] .right {
        display: flex;
        /* Without this, the mode button tooltips will be placed behind the serach bar. */
        flex-direction: column-reverse;
    }
        [slot='header'] .right .mode {
            display: flex;
            justify-content: flex-end;
        }
            [slot='header'] .right .mode div {
                height: 2.75rem;
                line-height: 2.75rem;
                margin-right: 1rem;
            }
        [slot='header'] .right wa-input[type='search'] {
            margin-top: 0.5rem;
        }
[slot*='header'] a {
    font-weight: var(--wa-font-weight-action);
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
[slot='navigation-header'] {
    display: block;
    border-block-end: var(--wa-border-width-s) var(--wa-border-style) var(--wa-color-surface-border);
    font-weight: 700;
    color: var(--wa-color-brand-on-normal);
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
[slot='navigation-footer'] {
    border-block-start: var(--wa-border-width-s) var(--wa-border-style) var(--wa-color-surface-border);
    padding: 1rem 0;
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
main .content {
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
aside.wa-desktop-only {
    padding-left: 0;
}
aside ul,
nav ul {
    margin: 0;
    padding: 0;
    text-align: left;
    list-style-type: none;
}
aside li,
nav li {
    padding: 0.25rem 1rem;
}
aside ul {
    padding: 1rem 0;
    border-radius: 0.5rem;
    border: solid 1px var(--wa-color-neutral-border-normal);
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
li.title {
    font-weight: 700;
    color: var(--wa-color-brand-on-normal);
}
/**********************
    CONTENT STYLES
***********************/
.content h1 {
    font-variant: small-caps;
}
.content h2 {
    border-bottom: solid 1px var(--wa-color-brand-border-loud);
}
.content a {
    color: var(--wa-color-text-link);
}
.content blockquote {
    margin: 1em 0;
    padding: 0.5em 1em;
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
.content > div > div.table-of-contents > ul {
    position: relative;
    list-style-type: none;
    color: var(--wa-color-text-normal);
    border: solid 1px var(--wa-color-neutral-border-normal);
    border-radius: 0.5em;
    padding: 1rem 0;
    margin-top: 1.5rem;
}
    .content > div > div.table-of-contents > ul a {
        color: var(--wa-color-text-normal);
    }
    .content > div > div.table-of-contents > ul > li > a {
        display: block;
        padding: 0 1rem;
        margin: 0.25rem 0;
    }
        .content > div > div.table-of-contents > ul > li > a:hover,
        .content > div > div.table-of-contents > ul ul > li:hover {
            background-color: var(--wa-color-neutral-fill-quiet);
        }
    .content > div > div.table-of-contents > ul::before {
        content: 'Table of contents';
        position: absolute;
        top: -0.75rem;
        left: 0.5rem;
        font-weight: 700;
        color: var(--wa-color-brand-on-normal);
        background-color: var(--wa-color-surface-default);
        display: block;
        padding: 0 0.5rem;
    }
    .content .table-of-contents ul ul {
        /* Nested TOC */
        padding: 0;
    }
    .content .table-of-contents ul ul li {
        display: block;
        padding-left: 2.75rem;
    }
    .content .table-of-contents ul ul li::before {
        content: '⚬';
        position: absolute;
        left: 1.5rem;
        color: var(--wa-color-text-quiet);
    }
</style>
