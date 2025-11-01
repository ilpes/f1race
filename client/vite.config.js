import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'home.html'),
                race: resolve(__dirname, 'race.html'),
                warmup: resolve(__dirname, 'warmup.html')
            }
        },
        sourcemap: true,
    },
    plugins: [
        {
            name: 'html-transform',
            transformIndexHtml: {
                order: 'pre',
                handler(html) {
                    return html.replace(
                        /%ANALYTICS%/g,
                        process.env.NODE_ENV === 'production'
                            ? '<script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>'
                            : ''
                    )
                }
            }
        }
    ]
});
