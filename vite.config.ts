import { defineConfig } from 'vite'
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
    ]
})
