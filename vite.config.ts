import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
    assetsInclude: ['**/*.md'],
    base: '/',
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: ((tag) => {
                        return tag.startsWith('wa-')
                    })
                }
            }
        }),
        viteStaticCopy({
            structured: true,
            targets: [
                {
                    dest: '/',
                    rename: (_name, _ext, path) => {
                        // Get the docs path from the full file path.
                        return '../../../../' + path.substring(path.indexOf('/src/docs/') + 5)
                    },
                    src: 'src/docs/**/*.md',
                },
            ],
        }),
    ]
})
