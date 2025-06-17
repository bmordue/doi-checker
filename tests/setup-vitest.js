// test/setup-vitest.js
// This file is run before each test file.
// You can add global setup here.

// Make sure global.fetch is writable for mocking
const globalFetch = global.fetch;
Object.defineProperty(global, 'fetch', {
  value: globalFetch,
  writable: true,
  configurable: true,
});
