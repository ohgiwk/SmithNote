import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { randomUUID } from 'node:crypto';

export default defineConfig(({ mode }) => {
  const isCapacitorBuild = mode === 'capacitor';
  const buildId = randomUUID();

  return {
    base: isCapacitorBuild ? './' : '/SmithNote/',
    define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
    plugins: [
      react(),
      {
        name: 'app-update-version',
        apply: 'build',
        generateBundle() {
          if (!isCapacitorBuild) {
            this.emitFile({
              type: 'asset',
              fileName: 'app-version.json',
              source: JSON.stringify({ buildId }),
            });
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        input: isCapacitorBuild ? 'index.html' : ['index.html', 'app/index.html'],
      },
    },
  };
});
