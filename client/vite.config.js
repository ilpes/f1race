import { resolve } from 'path'
import { defineConfig } from 'vite'


export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'index.html'),
                race: resolve(__dirname, 'race.html')
            }
        }
    }
});
