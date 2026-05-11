import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import Home from './views/Home.vue'
import About from './views/About.vue'
import Docs from './views/Docs.vue'
import License from './views/License.vue'

export type DocumentationTree = Record<string, NavigationItem[]>

export type NavigationItem = {
    name: string
    path: string
    subitems?: NavigationItem[]
    /** Documentation version. */
    version?: string
}

/**
 * Array of navigation items for the documentation.
 * ````
 * {
 *   name: <Title of the section>,
 *   path: <Full router path>,
 *   subitems?: <Array of possible subitems>
 * }[]
 * ````
 */
export const documentation = {
    'Platform': [
        {
            name: 'Introduction',
            path: 'platform/introduction',
        },
        {
            name: 'Deployment',
            path: 'platform/deployment',
        },
        {
            name: 'Configuration',
            path: 'platform/configuration',
        },
        {
            name: 'Project development',
            path: 'platform/project-development',
            subitems: [
                {
                    name: 'Fork',
                    path: 'platform/project-development/fork',
                },
                {
                    name: 'Submodule',
                    path: 'platform/project-development/submodule',
                },
                {
                    name: 'Testing',
                    path: 'platform/project-development/testing',
                },
                {
                    name: 'Extending annotations',
                    path: 'platform/project-development/annotations',
                },
            ],
        },
    ],
    'Basic use': [
        {
            name: 'Introduction',
            path: 'introduction',
        },
        {
            name: 'Annotations',
            path: 'annotations',
        },
        {
            name: 'Getting started',
            path: 'getting-started',
            subitems: [
                {
                    name: 'Installation',
                    path: 'getting-started/installation',
                },
                {
                    name: 'Usage',
                    path: 'getting-started/usage',
                },
                {
                    name: 'Opening files',
                    path: 'getting-started/opening-files',
                },
                {
                    name: 'Platform integration',
                    path: 'getting-started/platform-integration',
                },
            ],
        },
        {
            name: 'User interface',
            path: 'user-interface',
            subitems: [
                {
                    name: 'Settings',
                    path: 'user-interface/settings',
                },
                {
                    name: 'Interface layout',
                    path: 'user-interface/interface-layout',
                },
            ],
        },
    ],
    'Study modules': [
        {
            name: 'EEG module',
            path: 'eeg-module',
            subitems: [
                {
                    name: 'Supported file types',
                    path: 'eeg-module/supported-file-types',
                },
                {
                    name: 'EEG viewer',
                    path: 'eeg-module/eeg-viewer',
                },
                {
                    name: 'Analysis tools',
                    path: 'eeg-module/analysis-tools',
                },
            ],
        },
    ],
    'File readers': [
        {
            name: 'DICOM reader',
            path: 'dicom-reader',

        },
        {
            name: 'EDF reader',
            path: 'edf-reader',

        },
    ],
    'Advanced topics': [
        {
            name: 'Implementation',
            path: 'implementation',

        },
        {
            name: 'Library structure',
            path: 'library-structure',
        },
    ],
    'For developers': [
        {
            name: 'Development',
            path: 'development',

        },
    ],
 } as DocumentationTree

/** Array of Vue Router routes. */
const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        name: 'Home',
        component: Home,
    },
    {
        path: '/about',
        name: 'About',
        component: About,
    },
    {
        path: '/docs/:path+',
        name: 'Docs',
        component: Docs,
        props: true,
        meta: {
            name: 'Documentation',
            next: null as { name: string, path: string } | null,
            prev: null as { name: string, path: string } | null,
            subitems: null as NavigationItem[] | null,
        },
    },
    {
        path: '/license',
        name: 'License',
        component: License,
    },
];

/**
 * Time to wait (in ms) before scrolling to an anchor on the page.
 * @remarks
 * Initial page load takes longer due to all the rendering involved. This time can be reduced
 * for subsequent navigations.
 */
let SCROLL_DELAY = 1000
/** The Vue Router instance. */
const router = createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior(to, _from, savedPosition) {
        // Since we are using hash history, we can't use the browser's native scroll behavior.
        // Instead, we will use a custom scroll behavior that scrolls to the hash if it exists.
        return new Promise((resolve, _reject) => {
            // Documentation is parsed from markdown files, so we need to wait for the markdown
            // to be rendered before scrolling.
            // Unfortunately, there is no way to hook this to the actual rendering process, so
            // we'll have to use a timeout.
            setTimeout(() => {
                // After the initial page load we can reduce the scroll delay significantly.
                SCROLL_DELAY = 100
                if (to.hash) {
                    return resolve({
                        el: to.hash,
                        // Offset below the sticky header (~6rem) + subheader (~3rem)
                        // plus a little breathing room.
                        top: 200,
                        behavior: 'smooth',
                    })
                }
                // If a saved position exists, we will scroll to that position.
                if (savedPosition) {
                    return resolve(savedPosition)
                }
                // By default, we will scroll to the top of the page.
                return resolve({ top: 0 })
            }, SCROLL_DELAY)
        })
    },
})

export default router
