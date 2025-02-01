
declare module '*.vue' {
    import { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

declare module 'markdown-it-table-of-contents' {
    import { PluginSimple } from 'markdown-it'
    const plugin: PluginSimple
    export default plugin
}