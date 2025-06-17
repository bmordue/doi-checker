// test/integration/worker.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'; // Added beforeEach
import worker from '../../src/worker.js'; // Assuming worker.js is in src
import { DOI_CONFIG } from '../../src/config/constants.js'; // Assuming constants.js is in src/config

// Helper function to create a KV namespace mock (from previous step)
const createKVNamespaceMock = () => {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key)),
    put: vi.fn(async (key, value) => { store.set(key, value); }),
    delete: vi.fn(async (key) => { store.delete(key); }),
    // Basic list mock, can be enhanced if options (prefix, limit, cursor) are needed
    list: vi.fn(async () => ({
      keys: Array.from(store.keys()).map(name => ({ name })),
      list_complete: true, // Assuming simple full lists for now
      cursor: undefined
    })),
    _store: store, // For direct inspection in tests
  };
};

describe('Worker Integration Tests', () => {
  let DOIS_KV;
  let STATUS_KV;
  let env;
  let mockFetch; // Declare mockFetch here

  beforeEach(() => {
    DOIS_KV = createKVNamespaceMock();
    STATUS_KV = createKVNamespaceMock();
    env = {
      DOIS: DOIS_KV,
      STATUS: STATUS_KV,
      ACTIVITYPUB_ENABLED: 'true', // Default to true for testing, can be overridden
      SNAC2_SERVER_URL: 'https://mock.activitypub.server/api/snac2',
      SNAC2_TOKEN: 'mock-activitypub-token',
      // Add any other environment variables your worker might expect
    };

    // Reset all mocks before each test
    vi.resetAllMocks(); // Ensures spies on KV methods are fresh too

    // Mock global.fetch
    mockFetch = vi.fn(); // Assign to the outer scope variable
    global.fetch = mockFetch;

    // Mock crypto.randomUUID for predictable request IDs
    // Ensure 'crypto' is available in the test environment (Miniflare should provide it)
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('mock-uuid-request-id');
    } else {
      // Fallback or warning if crypto.randomUUID is not available
      global.crypto = { ...global.crypto, randomUUID: vi.fn().mockReturnValue('mock-uuid-request-id') };
    }
  });

  // Remove the placeholder test or keep it to ensure setup is working
  it('should initialize mocks correctly', () => {
    expect(mockFetch).toBeDefined();
    expect(global.fetch).toBe(mockFetch);
    expect(DOIS_KV.get).toBeCalledTimes(0); // Example assertion
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
        expect(global.crypto.randomUUID()).toBe('mock-uuid-request-id');
    }
  });

  describe('POST /add-doi', () => {
    it('should add a valid DOI to the list', async () => {
      const request = new Request('http://localhost/add-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: '10.1234/valid-doi' }),
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.message).toBe('DOI 10.1234/valid-doi added to monitoring list');
      expect(responseBody.doi).toBe('10.1234/valid-doi');
      expect(DOIS_KV.get).toHaveBeenCalledWith(DOI_CONFIG.DOI_LIST_KEY);
      expect(DOIS_KV.put).toHaveBeenCalledWith(
        DOI_CONFIG.DOI_LIST_KEY,
        JSON.stringify(['10.1234/valid-doi']) // Note: The worker normalizes/validates, ensure this matches worker logic if it changes the input
      );
    });

    it('should not add a duplicate DOI and confirm it already exists', async () => {
      // Pre-populate KV with an existing DOI
      const initialDoiList = ['10.1234/existing-doi'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(initialDoiList));

      const request = new Request('http://localhost/add-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: '10.1234/existing-doi' }),
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200); // Or whatever status code your worker returns for this case
      expect(responseBody.message).toContain('DOI 10.1234/existing-doi added to monitoring list'); // The worker's current message indicates it was "added" even if it exists.
      expect(DOIS_KV.get).toHaveBeenCalledWith(DOI_CONFIG.DOI_LIST_KEY);
      // Check that put was called, but the list effectively remains the same or reflects the worker's logic for duplicates.
      // The current worker code will re-save the list even if the DOI is a duplicate but already normalized.
      expect(DOIS_KV.put).toHaveBeenCalledWith(
        DOI_CONFIG.DOI_LIST_KEY,
        JSON.stringify(['10.1234/existing-doi'])
      );
       // Verify the list in the store is still just the one DOI
      const storedList = JSON.parse(DOIS_KV._store.get(DOI_CONFIG.DOI_LIST_KEY) || '[]');
      expect(storedList).toEqual(['10.1234/existing-doi']);
    });

    it('should return 400 for an invalid DOI format', async () => {
      const request = new Request('http://localhost/add-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: 'invalid-doi-format' }),
      });

      const response = await worker.fetch(request, env);
      const responseBodyText = await response.text(); // Error might be plain text

      expect(response.status).toBe(400);
      expect(responseBodyText).toContain('Invalid DOI'); // Or more specific error from your validator
      expect(DOIS_KV.put).not.toHaveBeenCalled();
    });

    it('should return 400 for a request with invalid JSON payload', async () => {
      const request = new Request('http://localhost/add-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'this is not json',
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('Invalid JSON in request body');
      expect(DOIS_KV.put).not.toHaveBeenCalled();
    });

    it('should return 400 if doi field is missing', async () => {
      const request = new Request('http://localhost/add-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ not_a_doi: '10.1234/valid-doi' }),
      });

      const response = await worker.fetch(request, env);
      const responseBodyText = await response.text();

      expect(response.status).toBe(400);
      // This will depend on how validateDOI handles a missing or undefined doi input.
      // Assuming it leads to an "Invalid DOI" type error.
      expect(responseBodyText).toContain('Invalid DOI');
      expect(DOIS_KV.put).not.toHaveBeenCalled();
    });
  });

  describe('POST /remove-doi', () => {
    it('should remove an existing DOI from the list and its status', async () => {
      // Pre-populate KV with an existing DOI and its status
      const initialDoiList = ['10.1234/to-remove', '10.5678/to-keep'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(initialDoiList));
      STATUS_KV._store.set('10.1234/to-remove', JSON.stringify({ working: true }));

      const request = new Request('http://localhost/remove-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: '10.1234/to-remove' }),
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.message).toBe('DOI 10.1234/to-remove removed from monitoring list');
      expect(responseBody.doi).toBe('10.1234/to-remove');

      expect(DOIS_KV.get).toHaveBeenCalledWith(DOI_CONFIG.DOI_LIST_KEY);
      expect(DOIS_KV.put).toHaveBeenCalledWith(
        DOI_CONFIG.DOI_LIST_KEY,
        JSON.stringify(['10.5678/to-keep']) // Only the remaining DOI
      );
      // Verify the list in the store
      const storedList = JSON.parse(DOIS_KV._store.get(DOI_CONFIG.DOI_LIST_KEY) || '[]');
      expect(storedList).toEqual(['10.5678/to-keep']);

      expect(STATUS_KV.delete).toHaveBeenCalledWith('10.1234/to-remove');
    });

    it('should return 404 if the DOI to remove is not found in the list', async () => {
      // Pre-populate KV with some DOIs
      const initialDoiList = ['10.5678/another-doi'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(initialDoiList));

      const request = new Request('http://localhost/remove-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: '10.1234/non-existent-doi' }),
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(404);
      expect(responseBody.error).toBe('DOI 10.1234/non-existent-doi not found in monitoring list');
      expect(DOIS_KV.put).not.toHaveBeenCalled();
      expect(STATUS_KV.delete).not.toHaveBeenCalled();
    });

    it('should return 404 if the DOI list itself does not exist', async () => {
      // DOIS_KV store is empty (no DOI_LIST_KEY set)

      const request = new Request('http://localhost/remove-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: '10.1234/any-doi' }),
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(404);
      expect(responseBody.error).toBe('No DOIs configured'); // As per worker logic
      expect(DOIS_KV.put).not.toHaveBeenCalled();
      expect(STATUS_KV.delete).not.toHaveBeenCalled();
    });

    it('should return 400 for a request with invalid JSON payload', async () => {
      const request = new Request('http://localhost/remove-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'this is not json',
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('Invalid JSON in request body');
      expect(DOIS_KV.put).not.toHaveBeenCalled();
      expect(STATUS_KV.delete).not.toHaveBeenCalled();
    });

    it('should return 400 if doi field is missing in the payload', async () => {
      const request = new Request('http://localhost/remove-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ not_the_doi_field: '10.1234/some-doi' }),
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('DOI is required'); // As per worker logic for removeDOI
      expect(DOIS_KV.put).not.toHaveBeenCalled();
      expect(STATUS_KV.delete).not.toHaveBeenCalled();
    });
  });

  describe('GET /status', () => {
    it('should return an empty list and zero counts when no DOIs are configured', async () => {
      // DOIS_KV is empty by default from beforeEach or ensure DOI_LIST_KEY is not set
      // Or explicitly set it to an empty list
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify([]));

      const request = new Request('http://localhost/status', { method: 'GET' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({
        dois: [],
        count: 0,
        working: 0,
        broken: 0,
        unchecked: 0,
      });
      expect(DOIS_KV.get).toHaveBeenCalledWith(DOI_CONFIG.DOI_LIST_KEY);
    });

    it('should return status for all configured DOIs with varied statuses', async () => {
      const doiList = ['10.1/working', '10.2/broken', '10.3/unchecked', '10.4/corrupted'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));

      const time = new Date().toISOString();
      STATUS_KV._store.set('10.1/working', JSON.stringify({ working: true, lastCheck: time, httpStatus: 200 }));
      STATUS_KV._store.set('10.2/broken', JSON.stringify({ working: false, lastCheck: time, httpStatus: 404, error: 'Not Found' }));
      // For 10.3/unchecked, no status entry will exist yet, or it's explicitly null
      // For 10.4/corrupted, put invalid JSON
      STATUS_KV._store.set('10.4/corrupted', 'this is not json');


      const request = new Request('http://localhost/status', { method: 'GET' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.count).toBe(4);
      expect(responseBody.working).toBe(1);
      expect(responseBody.broken).toBe(1);
      expect(responseBody.unchecked).toBe(2); // 10.3/unchecked and 10.4/corrupted (which becomes unchecked with an error)

      expect(responseBody.dois).toContainEqual({
        doi: '10.1/working', working: true, lastCheck: time, httpStatus: 200
      });
      expect(responseBody.dois).toContainEqual({
        doi: '10.2/broken', working: false, lastCheck: time, httpStatus: 404, error: 'Not Found'
      });
      expect(responseBody.dois).toContainEqual({
        doi: '10.3/unchecked', working: null, lastCheck: null // Default for missing status
      });
      expect(responseBody.dois).toContainEqual({
        doi: '10.4/corrupted', working: null, lastCheck: null, error: 'Status data corrupted' // How worker handles corrupted status
      });

      expect(STATUS_KV.get).toHaveBeenCalledWith('10.1/working');
      expect(STATUS_KV.get).toHaveBeenCalledWith('10.2/broken');
      expect(STATUS_KV.get).toHaveBeenCalledWith('10.3/unchecked');
      expect(STATUS_KV.get).toHaveBeenCalledWith('10.4/corrupted');
    });

    it('should handle cases where DOI_LIST_KEY itself is not found in DOIS_KV', async () => {
      // DOIS_KV._store does not contain DOI_CONFIG.DOI_LIST_KEY (as per default beforeEach)

      const request = new Request('http://localhost/status', { method: 'GET' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200); // Worker returns 200 with empty list
      expect(responseBody).toEqual({
        dois: [],
        count: 0,
        working: 0,
        broken: 0,
        unchecked: 0,
      });
      expect(DOIS_KV.get).toHaveBeenCalledWith(DOI_CONFIG.DOI_LIST_KEY);
    });

    it('should handle invalid JSON in the DOI_LIST_KEY value', async () => {
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, 'this is not a valid json array');

      const request = new Request('http://localhost/status', { method: 'GET' });
      const response = await worker.fetch(request, env);

      // The worker's safeJsonParse should catch this and return an error response
      expect(response.status).toBe(500); // Or appropriate error code from createErrorResponse
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Invalid DOI list format');
    });
  });

  describe('GET /health', () => {
    it('should return 200 with status "ok"', async () => {
      const request = new Request('http://localhost/health', { method: 'GET' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ status: 'ok' });
      // Verify no KV interactions or fetch calls occurred for this endpoint
      expect(DOIS_KV.get).not.toHaveBeenCalled();
      expect(STATUS_KV.get).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('POST /check-now', () => {
    it('should return "No DOIs configured" if the DOI list is empty', async () => {
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify([]));
      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseText = await response.text(); // Worker returns plain text for this case

      expect(response.status).toBe(200);
      expect(responseText).toBe('No DOIs configured');
      expect(mockFetch).not.toHaveBeenCalled(); // No external calls if no DOIs
    });

    it('should return "No DOIs configured" if DOI_LIST_KEY is not found', async () => {
      // DOIS_KV is empty by default
      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseText = await response.text();

      expect(response.status).toBe(200);
      expect(responseText).toBe('No DOIs configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should check DOIs, update status, and not call ActivityPub if no newly broken DOIs', async () => {
      const doiList = ['10.1/working', '10.2/already-broken'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      // Previous status: 10.1 was working, 10.2 was broken
      STATUS_KV._store.set('10.1/working', JSON.stringify({ working: true, httpStatus: 200, lastCheck: 'some-date' }));
      STATUS_KV._store.set('10.2/already-broken', JSON.stringify({ working: false, httpStatus: 404, lastCheck: 'some-date' }));

      // Mock fetch for DOI checks
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200, url: 'https://doi.org/10.1/working' })) // 10.1/working still working
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.2/already-broken' })); // 10.2/already-broken still broken

      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.checked).toBe(2);
      expect(responseBody.newlyBroken).toBe(0);

      // Verify STATUS_KV updates
      expect(STATUS_KV.put).toHaveBeenCalledWith(expect.stringContaining('10.1/working'), expect.stringContaining('"working":true'));
      expect(STATUS_KV.put).toHaveBeenCalledWith(expect.stringContaining('10.2/already-broken'), expect.stringContaining('"working":false'));

      // Verify ActivityPub was not called (no mockFetch call for env.SNAC2_SERVER_URL)
      expect(mockFetch.mock.calls.some(call => call[0] === env.SNAC2_SERVER_URL)).toBe(false);
    });

    it('should check DOIs, update status, and call ActivityPub if newly broken DOIs (ActivityPub enabled)', async () => {
      const doiList = ['10.1/newly-broken', '10.2/still-working'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      // Previous status: both were working
      STATUS_KV._store.set('10.1/newly-broken', JSON.stringify({ working: true, httpStatus: 200, lastCheck: 'some-date' }));
      STATUS_KV._store.set('10.2/still-working', JSON.stringify({ working: true, httpStatus: 200, lastCheck: 'some-date' }));

      // Mock fetch for DOI checks (10.1 becomes broken, 10.2 stays working)
      // The checker makes two fetches per DOI (HEAD then HEAD on final URL)
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken' })) // initial check for 10.1
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken' })) // final check for 10.1
        .mockResolvedValueOnce(new Response(null, { status: 200, url: 'https://doi.org/10.2/still-working' })) // initial for 10.2
        .mockResolvedValueOnce(new Response(null, { status: 200, url: 'https://doi.org/10.2/still-working' })); // final for 10.2

      // Mock fetch for ActivityPub post
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'activity-pub-post-id' }), { status: 201 }));


      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.checked).toBe(2);
      expect(responseBody.newlyBroken).toBe(1);
      expect(responseBody.results.find(r => r.doi === '10.1/newly-broken').working).toBe(false);

      // Verify STATUS_KV updates
      expect(STATUS_KV.put).toHaveBeenCalledWith(expect.stringContaining('10.1/newly-broken'), expect.stringContaining('"working":false'));
      expect(STATUS_KV.put).toHaveBeenCalledWith(expect.stringContaining('10.2/still-working'), expect.stringContaining('"working":true'));

      // Verify ActivityPub was called
      const activityPubCall = mockFetch.mock.calls.find(call => call[0] === env.SNAC2_SERVER_URL);
      expect(activityPubCall).toBeDefined();
      expect(activityPubCall[1].method).toBe('POST');
      const activityPubBody = JSON.parse(activityPubCall[1].body);
      expect(activityPubBody.content).toContain('10.1/newly-broken');
    });

    it('should not call ActivityPub if newly broken DOIs but ActivityPub is disabled', async () => {
      env.ACTIVITYPUB_ENABLED = 'false'; // Disable ActivityPub
      const doiList = ['10.1/newly-broken'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      STATUS_KV._store.set('10.1/newly-broken', JSON.stringify({ working: true, httpStatus: 200, lastCheck: 'some-date' }));

      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken' }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken' }));


      const request = new Request('http://localhost/check-now', { method: 'POST' });
      await worker.fetch(request, env);

      expect(mockFetch.mock.calls.some(call => call[0] === env.SNAC2_SERVER_URL)).toBe(false);
    });

    it('should handle error during ActivityPub posting gracefully', async () => {
      const doiList = ['10.1/newly-broken-ap-fail'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      STATUS_KV._store.set('10.1/newly-broken-ap-fail', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-ap-fail' })) // DOI check broken
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-ap-fail' }))
        .mockRejectedValueOnce(new Error('ActivityPub network error')); // ActivityPub post fails

      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200); // Main operation still successful
      expect(responseBody.newlyBroken).toBe(1);
      // Log should show an error for ActivityPub, but the request succeeds.
      expect(STATUS_KV.put).toHaveBeenCalledWith(expect.stringContaining('10.1/newly-broken-ap-fail'), expect.stringContaining('"working":false'));
    });

    // Note: The worker's checkAllDOIs re-throws errors from checkMultipleDOIs or KV interactions.
    // The fetch handler in worker.js catches these and returns a 500.
    it('should return 500 if checkMultipleDOIs fails (e.g., fetch for DOI throws unexpected error)', async () => {
      const doiList = ['10.1/fail-check'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      STATUS_KV._store.set('10.1/fail-check', JSON.stringify({ working: true, httpStatus: 200 }));

      // Mock fetch for DOI check to throw an unhandled error
      mockFetch.mockRejectedValueOnce(new Error('Unexpected network failure'));

      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(500);
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Internal Server Error'); // Or more specific if error is passed through
    });
  });

  describe('scheduled handler', () => {
    it('should complete successfully with no action if DOI list is empty', async () => {
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify([]));

      // scheduled handler logs to console, doesn't return a Response object like fetch.
      // We expect it not to throw.
      await expect(worker.scheduled(env)).resolves.toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should complete successfully with no action if DOI_LIST_KEY is not found', async () => {
      await expect(worker.scheduled(env)).resolves.toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should check DOIs, update status, and not call ActivityPub if no newly broken DOIs', async () => {
      const doiList = ['10.1/working', '10.2/already-broken'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      STATUS_KV._store.set('10.1/working', JSON.stringify({ working: true, httpStatus: 200 }));
      STATUS_KV._store.set('10.2/already-broken', JSON.stringify({ working: false, httpStatus: 404 }));

      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200, url: 'https://doi.org/10.1/working' }))
        .mockResolvedValueOnce(new Response(null, { status: 200, url: 'https://doi.org/10.1/working' }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.2/already-broken' }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.2/already-broken' }));

      await expect(worker.scheduled(env)).resolves.toBeUndefined();

      expect(STATUS_KV.put).toHaveBeenCalledWith(expect.stringContaining('10.1/working'), expect.stringContaining('"working":true'));
      expect(STATUS_KV.put).toHaveBeenCalledWith(expect.stringContaining('10.2/already-broken'), expect.stringContaining('"working":false'));
      expect(mockFetch.mock.calls.some(call => call[0] === env.SNAC2_SERVER_URL)).toBe(false);
    });

    it('should check DOIs, update status, and call ActivityPub if newly broken DOIs (ActivityPub enabled)', async () => {
      const doiList = ['10.1/newly-broken'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      STATUS_KV._store.set('10.1/newly-broken', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken' }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken' }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ap-post' }), { status: 201 })); // ActivityPub success

      await expect(worker.scheduled(env)).resolves.toBeUndefined();

      expect(STATUS_KV.put).toHaveBeenCalledWith(expect.stringContaining('10.1/newly-broken'), expect.stringContaining('"working":false'));
      const activityPubCall = mockFetch.mock.calls.find(call => call[0] === env.SNAC2_SERVER_URL);
      expect(activityPubCall).toBeDefined();
      expect(JSON.parse(activityPubCall[1].body).content).toContain('10.1/newly-broken');
    });

    it('should not call ActivityPub if newly broken DOIs but ActivityPub is disabled', async () => {
      env.ACTIVITYPUB_ENABLED = 'false';
      const doiList = ['10.1/newly-broken-no-ap'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      STATUS_KV._store.set('10.1/newly-broken-no-ap', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-no-ap' }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-no-ap' }));

      await expect(worker.scheduled(env)).resolves.toBeUndefined();
      expect(mockFetch.mock.calls.some(call => call[0] === env.SNAC2_SERVER_URL)).toBe(false);
    });

    it('should complete successfully even if ActivityPub posting fails', async () => {
      const doiList = ['10.1/newly-broken-ap-error'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      STATUS_KV._store.set('10.1/newly-broken-ap-error', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-ap-error' }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-ap-error' }))
        .mockRejectedValueOnce(new Error('AP network failure')); // ActivityPub fails

      await expect(worker.scheduled(env)).resolves.toBeUndefined(); // Worker logs error but doesn't fail scheduled event
      expect(STATUS_KV.put).toHaveBeenCalledWith(expect.stringContaining('10.1/newly-broken-ap-error'), expect.stringContaining('"working":false'));
    });

    it('should throw an error if checkMultipleDOIs fails (e.g., fetch for DOI throws)', async () => {
      const doiList = ['10.1/fail-check-scheduled'];
      DOIS_KV._store.set(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      STATUS_KV._store.set('10.1/fail-check-scheduled', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch.mockRejectedValueOnce(new Error('Network failure during DOI check'));

      // The scheduled handler re-throws errors from checkAllDOIs
      await expect(worker.scheduled(env)).rejects.toThrow('Network failure during DOI check');
    });
  });
});
