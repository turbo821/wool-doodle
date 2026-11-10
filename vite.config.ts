import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths, so the same build works on a web server and from disk inside the desktop app.
  base: './',
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1' },
});
