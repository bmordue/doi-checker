import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Optional: enable global APIs like describe, it
    environment: 'miniflare', // Use miniflare environment
    environmentOptions: {
      // Miniflare specific options:
      // You can specify modules, KV namespaces, DO bindings, etc. here if needed globally
      // For this test, we'll mock them dynamically within the test files.
      scriptPath: './src/worker.js', // Path to the worker script
      modules: true, // Enable module support
    },
    // To allow mocking of global.fetch, ensure it's not frozen
    setupFiles: ['./test/setup-vitest.js'], // A setup file if needed for global mocks
  },
  resolve: {
    // Required for Miniflare to resolve .js files as modules correctly
    mainFields: ['module', 'main'],
  },
});
