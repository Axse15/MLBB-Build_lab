import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// viteSingleFile menggabungkan JS + CSS ke satu index.html, jadi hasil build
// bisa di-deploy ke Vercel/Netlify/GitHub Pages atau dibuka langsung.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
});
