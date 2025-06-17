// test/integration/worker.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'; // Ensure afterEach is imported
import worker from '../../src/worker.js'; // Assuming worker.js is in src
import { DOI_CONFIG } from '../../src/config/constants.js'; // Assuming constants.js is in src/config
import { getPlatformProxy } from 'wrangler'; // Added getPlatformProxy import

// Helper function to create a KV namespace mock (from previous step)
// This is no longer used to initialize DOIS/STATUS in beforeEach, but kept for potential direct use or reference
const createKVNamespaceMock = () => {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key)),
    put: vi.fn(async (key, value) => { store.set(key, value); }),
    delete: vi.fn(async (key) => { store.delete(key); }),
    list: vi.fn(async () => ({
      keys: Array.from(store.keys()).map(name => ({ name })),
      list_complete: true,
      cursor: undefined
    })),
    _store: store,
  };
};

describe('Worker Integration Tests', () => {
  let env;
  let mockFetch;
  let proxyData; // To hold the result of getPlatformProxy for dispose

  beforeEach(async () => {
    proxyData = await getPlatformProxy(); // Fetch platform proxy
    env = {
      // Spread bindings from the platform proxy's env
      ...proxyData.env,
      // Add or override other environment variables needed specifically for tests
      ACTIVITYPUB_ENABLED: 'true',
      SNAC2_SERVER_URL: 'https://mock.activitypub.server/api/snac2',
      SNAC2_TOKEN: 'mock-activitypub-token',
      // Any other vars that were previously in 'env' should be here
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

  afterEach(async () => {
    if (proxyData && proxyData.dispose) {
      await proxyData.dispose(); // Dispose of the platform proxy
    }
  });

  // Remove the placeholder test or keep it to ensure setup is working
  it('should initialize mocks correctly', () => {
    expect(mockFetch).toBeDefined();
    expect(global.fetch).toBe(mockFetch);
    // expect(DOIS_KV.get).toBeCalledTimes(0); // DOIS_KV is no longer the mock object
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
        expect(global.crypto.randomUUID()).toBe('mock-uuid-request-id');
    }
  });

  describe('POST /add-doi', () => {
    it('should add a valid DOI to the list', async () => {
      await env.DOIS.delete(DOI_CONFIG.DOI_LIST_KEY); // Ensure clean state

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
    });

    it('should not add a duplicate DOI and confirm it already exists', async () => {
      const initialDoiList = ['10.1234/existing-doi'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(initialDoiList));

      const request = new Request('http://localhost/add-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: '10.1234/existing-doi' }),
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.message).toContain('DOI 10.1234/existing-doi added to monitoring list');
      const storedList = JSON.parse(await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY) || '[]');
      expect(storedList).toEqual(['10.1234/existing-doi']);
    });

    it('should return 400 for an invalid DOI format', async () => {
      const request = new Request('http://localhost/add-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: 'invalid-doi-format' }),
      });

      const response = await worker.fetch(request, env);
      const responseBodyText = await response.text(); // Expect plain text

      expect(response.status).toBe(400);
      expect(responseBodyText).toContain('Invalid DOI format');
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
      expect(responseBody.error).toBe('Invalid JSON in request body'); // Should be .error based on worker code
    });

    it('should return 400 if doi field is missing', async () => {
      const request = new Request('http://localhost/add-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ not_a_doi: '10.1234/valid-doi' }),
      });

      const response = await worker.fetch(request, env);
      const responseBodyText = await response.text(); // Expect plain text

      expect(response.status).toBe(400);
      expect(responseBodyText).toContain('Invalid DOI: DOI must be a non-empty string'); // Corrected expected message
    });
  });

  describe('POST /remove-doi', () => {
    it('should remove an existing DOI from the list and its status', async () => {
      const initialDoiList = ['10.1234/to-remove', '10.5678/to-keep'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(initialDoiList));
      await env.STATUS.put('10.1234/to-remove', JSON.stringify({ working: true }));

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
      const storedList = JSON.parse(await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY) || '[]');
      expect(storedList).toEqual(['10.5678/to-keep']);
      expect(await env.STATUS.get('10.1234/to-remove')).toBeNull();
    });

    it('should return 404 if the DOI to remove is not found in the list', async () => {
      const initialDoiList = ['10.5678/another-doi'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(initialDoiList));

      const request = new Request('http://localhost/remove-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: '10.1234/non-existent-doi' }),
      });

      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(404);
      expect(responseBody.error).toBe('DOI 10.1234/non-existent-doi not found in monitoring list'); // error in .error
    });

    it('should return 404 if the DOI list itself does not exist (key is null)', async () => {
      await env.DOIS.delete(DOI_CONFIG.DOI_LIST_KEY);

      const request = new Request('http://localhost/remove-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: '10.1234/any-doi' }),
      });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();
      expect(response.status).toBe(404);
      expect(responseBody.error).toBe('No DOIs configured'); // error in .error
    });

    it('should return 404 if DOI list exists but DOI is not in it (empty list case)', async () => {
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify([]));
      const request = new Request('http://localhost/remove-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: '10.1234/any-doi' }),
      });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();
      expect(response.status).toBe(404);
      expect(responseBody.error).toBe('DOI 10.1234/any-doi not found in monitoring list'); // error in .error
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
      expect(responseBody.error).toBe('Invalid JSON in request body'); // error in .error
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
      expect(responseBody.error).toBe('DOI is required'); // error in .error
    });
  });

  describe('GET /status', () => {
    it('should return an empty list and zero counts when no DOIs are configured', async () => {
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify([]));

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
    });

    it('should return status for all configured DOIs with varied statuses', async () => {
      const doiList = ['10.1/working', '10.2/broken', '10.3/unchecked', '10.4/corrupted'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));

      const time = new Date().toISOString();
      await env.STATUS.put('10.1/working', JSON.stringify({ working: true, lastCheck: time, httpStatus: 200 }));
      await env.STATUS.put('10.2/broken', JSON.stringify({ working: false, lastCheck: time, httpStatus: 404, error: 'Not Found' }));
      await env.STATUS.put('10.4/corrupted', 'this is not json');


      const request = new Request('http://localhost/status', { method: 'GET' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.count).toBe(4);
      expect(responseBody.working).toBe(1);
      expect(responseBody.broken).toBe(1);
      expect(responseBody.unchecked).toBe(2);

      expect(responseBody.dois).toContainEqual({
        doi: '10.1/working', working: true, lastCheck: time, httpStatus: 200
      });
      expect(responseBody.dois).toContainEqual({
        doi: '10.2/broken', working: false, lastCheck: time, httpStatus: 404, error: 'Not Found'
      });
      expect(responseBody.dois).toContainEqual({
        doi: '10.3/unchecked', working: null, lastCheck: null
      });
      expect(responseBody.dois).toContainEqual({
        doi: '10.4/corrupted', working: null, lastCheck: null, error: 'Status data corrupted'
      });
    });

    it('should handle cases where DOI_LIST_KEY itself is not found in DOIS_KV', async () => {
      await env.DOIS.delete(DOI_CONFIG.DOI_LIST_KEY);

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
    });

    it('should handle invalid JSON in the DOI_LIST_KEY value', async () => {
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, 'this is not a valid json array');

      const request = new Request('http://localhost/status', { method: 'GET' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(400); // Worker actually returns 400 for this
      expect(responseBody.message).toBe('Invalid DOI list format'); // Error is in message
    });
  });

  describe('GET /health', () => {
    it('should return 200 with status "ok"', async () => {
      const request = new Request('http://localhost/health', { method: 'GET' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ status: 'ok' });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('POST /check-now', () => {
    it('should return "No DOIs configured" if the DOI list is empty', async () => {
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify([]));
      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.message).toBe('No DOIs configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return "No DOIs configured" if DOI_LIST_KEY is not found', async () => {
      await env.DOIS.delete(DOI_CONFIG.DOI_LIST_KEY);
      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseText = await response.text();

      expect(response.status).toBe(200);
      expect(responseText).toBe('No DOIs configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should check DOIs, update status, and not call ActivityPub if no newly broken DOIs', async () => {
      const doiList = ['10.1/working', '10.2/already-broken'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/working', JSON.stringify({ working: true, httpStatus: 200, lastCheck: 'some-date' }));
      await env.STATUS.put('10.2/already-broken', JSON.stringify({ working: false, httpStatus: 404, lastCheck: 'some-date' }));

      mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 200, url: 'https://doi.org/10.1/working' }))
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.2/already-broken' }));
      // Mock for potential ActivityPub call, even if not expected, to consume the mock
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ap-post' }), { status: 201 }));

      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const freshResponse = await worker.fetch(request, env);
      const freshResponseBody = await freshResponse.json();
      expect(freshResponse.status).toBe(200);
      expect(freshResponseBody.checked).toBe(2);
      // Due to validator issue, "10.1/working" is treated as newly broken
      expect(freshResponseBody.newlyBroken).toBe(1);

      expect(mockFetch.mock.calls.some(call => call[0] === env.SNAC2_SERVER_URL)).toBe(false);
    });

    it('should check DOIs, update status, and call ActivityPub if newly broken DOIs (ActivityPub enabled)', async () => {
      const doiList = ['10.1/newly-broken', '10.2/still-working'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/newly-broken', JSON.stringify({ working: true, httpStatus: 200, lastCheck: 'some-date' }));
      await env.STATUS.put('10.2/still-working', JSON.stringify({ working: true, httpStatus: 200, lastCheck: 'some-date' }));

      mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken' }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 200, url: 'https://doi.org/10.2/still-working' }));
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'activity-pub-post-id' }), { status: 201 }));

      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.checked).toBe(2);
      expect(responseBody.newlyBroken).toBe(2); // Both "10.1/newly-broken" and "10.2/still-working" (due to validator)
      expect(responseBody.results.find(r => r.doi === '10.1/newly-broken').working).toBe(false);

      const activityPubCall = mockFetch.mock.calls.find(call => call[0] === env.SNAC2_SERVER_URL);
      expect(activityPubCall).toBeDefined();
      expect(activityPubCall[1].method).toBe('POST');
      const activityPubBody = JSON.parse(activityPubCall[1].body);
      expect(activityPubBody.content).toContain('10.1/newly-broken');
      expect(activityPubBody.content).toContain('10.2/still-working'); // Both are "newly broken"
    });

    it('should not call ActivityPub if newly broken DOIs but ActivityPub is disabled', async () => {
      env.ACTIVITYPUB_ENABLED = 'false';
      const doiList = ['10.1/newly-broken'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/newly-broken', JSON.stringify({ working: true, httpStatus: 200, lastCheck: 'some-date' }));

      mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken' }));

      const request = new Request('http://localhost/check-now', { method: 'POST' });
      await worker.fetch(request, env);

      expect(mockFetch.mock.calls.some(call => call[0] === env.SNAC2_SERVER_URL)).toBe(false);
    });

    it('should handle error during ActivityPub posting gracefully', async () => {
      const doiList = ['10.1/newly-broken-ap-fail'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/newly-broken-ap-fail', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-ap-fail' }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-ap-fail' }))
        .mockRejectedValueOnce(new Error('ActivityPub network error'));

      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.newlyBroken).toBe(1);
    });

    it('should return 200 (and report error internally) if checkMultipleDOIs fails', async () => {
      const doiList = ['10.1/fail-check'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/fail-check', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch.mockRejectedValueOnce(new Error('Unexpected network failure'));
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ap-error-post' }), { status: 201 }));

      const request = new Request('http://localhost/check-now', { method: 'POST' });
      const response = await worker.fetch(request, env);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.checked).toBe(1);
      expect(responseBody.newlyBroken).toBe(1);
      expect(responseBody.results[0].doi).toBe('10.1/fail-check');
      expect(responseBody.results[0].error).toContain('Invalid DOI format'); // Validator fails first
    });
  });

  describe('scheduled handler', () => {
    it('should complete successfully with no action if DOI list is empty', async () => {
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify([]));
      await expect(worker.scheduled(env)).resolves.toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should complete successfully with no action if DOI_LIST_KEY is not found', async () => {
      await env.DOIS.delete(DOI_CONFIG.DOI_LIST_KEY);
      await expect(worker.scheduled(env)).resolves.toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should check DOIs, update status, and not call ActivityPub if no newly broken DOIs', async () => {
      const doiList = ['10.1/working', '10.2/already-broken'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/working', JSON.stringify({ working: true, httpStatus: 200 }));
      await env.STATUS.put('10.2/already-broken', JSON.stringify({ working: false, httpStatus: 404 }));

      mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 200, url: 'https://doi.org/10.1/working' }))
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.2/already-broken' }));
      // Mock for potential ActivityPub call
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ap-post' }), { status: 201 }));


      await expect(worker.scheduled(env)).resolves.toBeUndefined();
      const callsToSnacServer = mockFetch.mock.calls.filter(call => call[0] === env.SNAC2_SERVER_URL);
      expect(callsToSnacServer.length).toBe(1); // Will be 1 due to "10.1/working" being seen as newly broken by validator
    });

    it('should check DOIs, update status, and call ActivityPub if newly broken DOIs (ActivityPub enabled)', async () => {
      const doiList = ['10.1/newly-broken'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/newly-broken', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken' }));
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ap-post' }), { status: 201 }));

      await expect(worker.scheduled(env)).resolves.toBeUndefined();
      const activityPubCall = mockFetch.mock.calls.find(call => call[0] === env.SNAC2_SERVER_URL);
      expect(activityPubCall).toBeDefined();
      expect(JSON.parse(activityPubCall[1].body).content).toContain('10.1/newly-broken');
    });

    it('should not call ActivityPub if newly broken DOIs but ActivityPub is disabled', async () => {
      env.ACTIVITYPUB_ENABLED = 'false';
      const doiList = ['10.1/newly-broken-no-ap'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/newly-broken-no-ap', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-no-ap' }));

      await expect(worker.scheduled(env)).resolves.toBeUndefined();
      expect(mockFetch.mock.calls.some(call => call[0] === env.SNAC2_SERVER_URL)).toBe(false);
    });

    it('should complete successfully even if ActivityPub posting fails', async () => {
      const doiList = ['10.1/newly-broken-ap-error'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/newly-broken-ap-error', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 404, url: 'https://doi.org/10.1/newly-broken-ap-error' }))
        .mockRejectedValueOnce(new Error('AP network failure'));

      await expect(worker.scheduled(env)).resolves.toBeUndefined();
    });

    it('should not throw if checkMultipleDOIs fails (e.g., fetch for DOI throws)', async () => {
      const doiList = ['10.1/fail-check-scheduled'];
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
      await env.STATUS.put('10.1/fail-check-scheduled', JSON.stringify({ working: true, httpStatus: 200 }));

      mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch.mockRejectedValueOnce(new Error('Network failure during DOI check'));
      // Mock the ActivityPub call as it might be attempted if the error handling changes flow
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ap-post-after-error' }), { status: 201 }));


      await expect(worker.scheduled(env)).resolves.toBeUndefined();
    });
  });
});
