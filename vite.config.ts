import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isCapacitorBuild = mode === 'capacitor';

  return {
    base: isCapacitorBuild ? './' : '/FitLog/',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: isCapacitorBuild ? 'index.html' : ['index.html', 'app/index.html'],
      },
    },
  };
});
