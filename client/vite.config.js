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
    }
});
