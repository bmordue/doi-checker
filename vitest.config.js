import { defineConfig } from 'vitest/config';

export default defineConfig({
  // plugins: [cloudflarePagesPlugin({ scriptPath: './src/worker.js', modules: true })],
  test: {
    globals: true, // Optional: enable global APIs like describe, it
    // environment: 'miniflare', // Use miniflare environment - REMOVED
    // environmentOptions: { // REMOVED
    //   // Miniflare specific options:
    //   // You can specify modules, KV namespaces, DO bindings, etc. here if needed globally
    //   // For this test, we'll mock them dynamically within the test files.
    //   // scriptPath: './src/worker.js', // Path to the worker script - Handled by plugin
    //   // modules: true, // Enable module support - Handled by plugin
    //   kvNamespaces: ["DOIS", "STATUS"], // Declare KV namespaces for Miniflare
    // },
    // To allow mocking of global.fetch, ensure it's not frozen
    setupFiles: ['./tests/setup-vitest.js'], // A setup file if needed for global mocks
  },
  assetsInclude: ['**/*.html'], // Add this line to treat HTML files as assets
  resolve: {
    // Required for Miniflare to resolve .js files as modules correctly
    mainFields: ['module', 'main'],
  },
});
