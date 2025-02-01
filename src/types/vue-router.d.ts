import 'vue-router'
import type { NavigationItem } from '../router'
declare module 'vue-router' {
    interface RouteMeta {
        name: string
        next: { path: string, name: string } | null
        prev: { path: string, name: string } | null
        subitems: NavigationItem[] | null
    }
}