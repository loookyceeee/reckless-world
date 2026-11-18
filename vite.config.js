import { defineConfig } from 'vite';
export default defineConfig({ base: process.env.BASE || './', build: { chunkSizeWarningLimit: 6000, target: 'es2020' }, server: { host: true } });
