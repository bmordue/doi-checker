// test/integration/worker.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../../src/worker.js'; // Assuming worker.js is in src
import { DOI_CONFIG } from '../../src/config/constants.js';

// Mock the checker module
vi.mock('../../src/lib/checker.js', () => ({
  checkMultipleDOIs: vi.fn(),
  // processResults is called by checkAllDOIs, so it needs to be mocked
  // It takes the results from checkMultipleDOIs and previousStatuses
  // For these tests, we mainly care that newlyBroken is an array (empty or not)
  processResults: vi.fn((results, previousStatuses) => {
    const newlyBroken = [];
    results.forEach((result) => {
      const prev = previousStatuses[result.doi];
      if ((!prev || prev.working) && !result.working) {
        newlyBroken.push(result.doi);
      }
    });
    return {
      newlyBroken,
      // other fields that processResults might return, if any, can be mocked if needed
    };
  }),
}));

// Import the mocked checkMultipleDOIs to use in tests
import { checkMultipleDOIs } from '../../src/lib/checker.js';

describe('Worker Timestamp Logic', () => {
  let mockEnv;

  beforeEach(() => {
    vi.clearAllMocks(); // Clears mock call counts and implementations
    mockEnv = {
      DOIS: {
        get: vi.fn(),
        put: vi.fn(), // Not directly used by checkAllDOIs for this test focus but good to have
      },
      STATUS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(), // Not directly used here but good practice
      },
      // Mock other env properties worker might use during checkAllDOIs or getStatus
      ACTIVITYPUB_ENABLED: 'false', // Disable for these tests to simplify
      SNAC2_SERVER_URL: 'https://mock.activitypub.server',
      SNAC2_TOKEN: 'mock-token',
      // Add any other env vars that might be accessed to avoid undefined errors
    };

    // Mock global.fetch for any unexpected calls (e.g. ActivityPub if not fully disabled)
    global.fetch = vi.fn();

    // Mock crypto.randomUUID if your worker uses it for logging or other purposes
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('mock-uuid');
    } else {
      global.crypto = { ...global.crypto, randomUUID: vi.fn().mockReturnValue('mock-uuid') };
    }
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore original implementations
  });

  describe('checkAllDOIs timestamp updates', () => {
    test('Scenario 1: New DOI, successful check', async () => {
      const doi = '10.123/new.doi';
      const checkTimestamp = new Date().toISOString();

      mockEnv.DOIS.get.mockResolvedValue(JSON.stringify([doi]));
      mockEnv.STATUS.get.mockResolvedValue(null); // No existing status

      const mockCheckResults = [
        {
          doi,
          working: true,
          httpStatus: 200,
          timestamp: checkTimestamp,
          finalUrl: `https://doi.org/${doi}`,
        },
      ];
      checkMultipleDOIs.mockResolvedValue(mockCheckResults);
      // processResults mock will be called internally by checkAllDOIs

      await worker.scheduled(mockEnv); // Trigger checkAllDOIs via scheduled handler

      expect(mockEnv.STATUS.put).toHaveBeenCalledTimes(1);
      expect(mockEnv.STATUS.put).toHaveBeenCalledWith(doi, expect.any(String));

      const savedStatus = JSON.parse(mockEnv.STATUS.put.mock.calls[0][1]);
      expect(savedStatus.firstCheckedTimestamp).toBe(checkTimestamp);
      expect(savedStatus.firstSuccessTimestamp).toBe(checkTimestamp);
      expect(savedStatus.firstFailureTimestamp).toBeUndefined();
      expect(savedStatus.lastCheck).toBe(checkTimestamp);
      expect(savedStatus.working).toBe(true);
    });

    test('Scenario 2: Existing DOI, first check fails, second check succeeds', async () => {
      const doi = '10.123/fail-then-succeed';
      const firstCheckTimestamp = new Date(Date.now() - 100000).toISOString(); // Older timestamp
      const secondCheckTimestamp = new Date().toISOString();

      // --- First check (failure) ---
      mockEnv.DOIS.get.mockResolvedValue(JSON.stringify([doi]));
      mockEnv.STATUS.get.mockResolvedValue(null); // No existing status initially

      let mockCheckResults = [
        {
          doi,
          working: false,
          httpStatus: 404,
          timestamp: firstCheckTimestamp,
          error: 'Not Found',
        },
      ];
      checkMultipleDOIs.mockResolvedValue(mockCheckResults);

      await worker.scheduled(mockEnv);

      expect(mockEnv.STATUS.put).toHaveBeenCalledTimes(1);
      const firstSavedStatusString = mockEnv.STATUS.put.mock.calls[0][1];
      const firstSavedStatus = JSON.parse(firstSavedStatusString);
      expect(firstSavedStatus.firstCheckedTimestamp).toBe(firstCheckTimestamp);
      expect(firstSavedStatus.firstFailureTimestamp).toBe(firstCheckTimestamp);
      expect(firstSavedStatus.firstSuccessTimestamp).toBeUndefined();
      expect(firstSavedStatus.lastCheck).toBe(firstCheckTimestamp);
      expect(firstSavedStatus.working).toBe(false);

      // --- Second check (success) ---
      mockEnv.STATUS.get.mockResolvedValue(firstSavedStatusString); // Return previous status
      mockCheckResults = [
        {
          doi,
          working: true,
          httpStatus: 200,
          timestamp: secondCheckTimestamp,
          finalUrl: `https://doi.org/${doi}`,
        },
      ];
      checkMultipleDOIs.mockResolvedValue(mockCheckResults);
      // processResults will be called again with the new results and previous status

      await worker.scheduled(mockEnv); // Trigger again

      expect(mockEnv.STATUS.put).toHaveBeenCalledTimes(2); // Called once for first, once for second
      const secondSavedStatus = JSON.parse(mockEnv.STATUS.put.mock.calls[1][1]);

      expect(secondSavedStatus.firstCheckedTimestamp).toBe(firstCheckTimestamp); // Should be preserved
      expect(secondSavedStatus.firstFailureTimestamp).toBe(firstCheckTimestamp); // Should be preserved
      expect(secondSavedStatus.firstSuccessTimestamp).toBe(secondCheckTimestamp); // Should be set
      expect(secondSavedStatus.lastCheck).toBe(secondCheckTimestamp); // Should be updated
      expect(secondSavedStatus.working).toBe(true);
    });

    test('Scenario 3: Existing DOI, first check succeeds, second check fails', async () => {
      const doi = '10.123/succeed-then-fail';
      const firstCheckTimestamp = new Date(Date.now() - 100000).toISOString();
      const secondCheckTimestamp = new Date().toISOString();

      // --- First check (success) ---
      mockEnv.DOIS.get.mockResolvedValue(JSON.stringify([doi]));
      mockEnv.STATUS.get.mockResolvedValue(null);

      let mockCheckResults = [
        {
          doi,
          working: true,
          httpStatus: 200,
          timestamp: firstCheckTimestamp,
          finalUrl: `https://doi.org/${doi}`,
        },
      ];
      checkMultipleDOIs.mockResolvedValue(mockCheckResults);

      await worker.scheduled(mockEnv);

      expect(mockEnv.STATUS.put).toHaveBeenCalledTimes(1);
      const firstSavedStatusString = mockEnv.STATUS.put.mock.calls[0][1];
      const firstSavedStatus = JSON.parse(firstSavedStatusString);
      expect(firstSavedStatus.firstCheckedTimestamp).toBe(firstCheckTimestamp);
      expect(firstSavedStatus.firstSuccessTimestamp).toBe(firstCheckTimestamp);
      expect(firstSavedStatus.firstFailureTimestamp).toBeUndefined();
      expect(firstSavedStatus.lastCheck).toBe(firstCheckTimestamp);

      // --- Second check (failure) ---
      mockEnv.STATUS.get.mockResolvedValue(firstSavedStatusString);
      mockCheckResults = [
        {
          doi,
          working: false,
          httpStatus: 500,
          timestamp: secondCheckTimestamp,
          error: 'Server Error',
        },
      ];
      checkMultipleDOIs.mockResolvedValue(mockCheckResults);

      await worker.scheduled(mockEnv);

      expect(mockEnv.STATUS.put).toHaveBeenCalledTimes(2);
      const secondSavedStatus = JSON.parse(mockEnv.STATUS.put.mock.calls[1][1]);
      expect(secondSavedStatus.firstCheckedTimestamp).toBe(firstCheckTimestamp);
      expect(secondSavedStatus.firstSuccessTimestamp).toBe(firstCheckTimestamp);
      expect(secondSavedStatus.firstFailureTimestamp).toBe(secondCheckTimestamp);
      expect(secondSavedStatus.lastCheck).toBe(secondCheckTimestamp);
    });

    test('Scenario 4: DOI status already has all timestamps, new check (success)', async () => {
      const doi = '10.123/all-timestamps-exist';
      const originalFirstChecked = new Date(Date.now() - 200000).toISOString();
      const originalFirstSuccess = new Date(Date.now() - 150000).toISOString();
      const originalFirstFailure = new Date(Date.now() - 100000).toISOString();
      const newCheckTimestamp = new Date().toISOString();

      const existingStatus = {
        doi,
        working: false, // Last check was a failure
        httpStatus: 500,
        lastCheck: originalFirstFailure, // last check corresponds to the failure
        firstCheckedTimestamp: originalFirstChecked,
        firstSuccessTimestamp: originalFirstSuccess,
        firstFailureTimestamp: originalFirstFailure,
        error: 'Some old error',
      };
      mockEnv.DOIS.get.mockResolvedValue(JSON.stringify([doi]));
      mockEnv.STATUS.get.mockResolvedValue(JSON.stringify(existingStatus));

      const mockCheckResults = [
        {
          doi,
          working: true, // New check is a success
          httpStatus: 200,
          timestamp: newCheckTimestamp,
          finalUrl: `https://doi.org/${doi}`,
        },
      ];
      checkMultipleDOIs.mockResolvedValue(mockCheckResults);

      await worker.scheduled(mockEnv);

      expect(mockEnv.STATUS.put).toHaveBeenCalledTimes(1);
      const savedStatus = JSON.parse(mockEnv.STATUS.put.mock.calls[0][1]);

      expect(savedStatus.firstCheckedTimestamp).toBe(originalFirstChecked); // Unchanged
      expect(savedStatus.firstSuccessTimestamp).toBe(originalFirstSuccess); // Unchanged
      expect(savedStatus.firstFailureTimestamp).toBe(originalFirstFailure); // Unchanged
      expect(savedStatus.lastCheck).toBe(newCheckTimestamp); // Updated
      expect(savedStatus.working).toBe(true); // Updated
      expect(savedStatus.error).toBeNull(); // Error cleared on success
    });
  });

  describe('GET /status endpoint', () => {
    test('includes new timestamp fields in the response', async () => {
      const doi = '10.123/status-test-doi';
      const now = new Date().toISOString();
      const mockDoiStatus = {
        working: true,
        httpStatus: 200,
        lastCheck: now,
        firstCheckedTimestamp: now,
        firstSuccessTimestamp: now,
        firstFailureTimestamp: null, // Explicitly null
        error: null,
      };

      mockEnv.DOIS.get.mockResolvedValue(JSON.stringify([doi]));
      mockEnv.STATUS.get.mockResolvedValue(JSON.stringify(mockDoiStatus));

      const request = new Request('http://localhost/status', { method: 'GET' });
      const response = await worker.fetch(request, mockEnv);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.dois).toHaveLength(1);
      const statusInResponse = body.dois[0];
      expect(statusInResponse.doi).toBe(doi);
      expect(statusInResponse.firstCheckedTimestamp).toBe(now);
      expect(statusInResponse.firstSuccessTimestamp).toBe(now);
      expect(statusInResponse.firstFailureTimestamp).toBeNull();
      expect(statusInResponse.lastCheck).toBe(now);
      expect(statusInResponse.working).toBe(true);
    });

    test('handles missing status by initializing timestamp fields to null in /status response', async () => {
      const doi = '10.123/missing-status-doi';
      mockEnv.DOIS.get.mockResolvedValue(JSON.stringify([doi]));
      mockEnv.STATUS.get.mockResolvedValue(null); // No status in KV

      const request = new Request('http://localhost/status', { method: 'GET' });
      const response = await worker.fetch(request, mockEnv);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.dois).toHaveLength(1);
      const statusInResponse = body.dois[0];
      expect(statusInResponse.doi).toBe(doi);
      expect(statusInResponse.working).toBeNull();
      expect(statusInResponse.lastCheck).toBeNull();
      expect(statusInResponse.firstCheckedTimestamp).toBeNull();
      expect(statusInResponse.firstSuccessTimestamp).toBeNull();
      expect(statusInResponse.firstFailureTimestamp).toBeNull();
    });
  });
});

describe('Worker addDOI endpoint', () => {
  let mockEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = {
      DOIS: {
        get: vi.fn(),
        put: vi.fn(),
      },
      STATUS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
      ACTIVITYPUB_ENABLED: 'false',
      SNAC2_SERVER_URL: 'https://mock.activitypub.server',
      SNAC2_TOKEN: 'mock-token',
    };

    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('mock-uuid');
    } else {
      global.crypto = { ...global.crypto, randomUUID: vi.fn().mockReturnValue('mock-uuid') };
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should add a list of valid DOIs', async () => {
    const doisToAdd = ['10.1000/xyz123', '10.1001/abc789'];
    mockEnv.DOIS.get.mockResolvedValue(JSON.stringify([])); // No existing DOIs

    const request = new Request('http://localhost/add-doi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
      },
      body: JSON.stringify({ dois: doisToAdd }),
    });

    const response = await worker.fetch(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Processed 2 DOIs: 2 added, 0 already existed, 0 invalid.');
    // Check that the 'results' array contains the expected DOIs with status 'added'
    expect(
      body.results.filter((r) => r.status === 'added').map((r) => r.normalized || r.doi)
    ).toEqual(expect.arrayContaining(doisToAdd));
    expect(body.results.filter((r) => r.status === 'added').length).toBe(doisToAdd.length);
    expect(body.results.filter((r) => r.status === 'already_existed').length).toBe(0);
    expect(body.results.filter((r) => r.status === 'invalid').length).toBe(0);
    expect(mockEnv.DOIS.put).toHaveBeenCalledWith(
      DOI_CONFIG.DOI_LIST_KEY,
      JSON.stringify(doisToAdd)
    );
  });

  it('should handle a mix of valid, invalid, and duplicate DOIs', async () => {
    const existingDoi = '10.1000/xyz123';
    const newValidDoi = '10.1001/abc789';
    const invalidDoi = 'invalid-doi';
    const prefixedDoi = 'https://doi.org/10.1002/efgh456';
    const normalizedPrefixedDoi = '10.1002/efgh456';
    const doisToAdd = [existingDoi, newValidDoi, invalidDoi, prefixedDoi];

    mockEnv.DOIS.get.mockResolvedValue(JSON.stringify([existingDoi]));

    const request = new Request('http://localhost/add-doi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
      },
      body: JSON.stringify({ dois: doisToAdd }),
    });

    const response = await worker.fetch(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Processed 4 DOIs: 2 added, 1 already existed, 1 invalid.');
    // Check added DOIs
    const addedResults = body.results.filter((r) => r.status === 'added');
    expect(addedResults.length).toBe(2);
    expect(addedResults.map((r) => r.normalized || r.doi)).toEqual(
      expect.arrayContaining([newValidDoi, normalizedPrefixedDoi])
    );

    // Check existing DOIs
    const existingResults = body.results.filter((r) => r.status === 'already_existed');
    expect(existingResults.length).toBe(1);
    expect(existingResults[0].doi).toBe(existingDoi);

    // Check invalid DOIs
    const invalidResults = body.results.filter((r) => r.status === 'invalid');
    expect(invalidResults.length).toBe(1);
    expect(invalidResults[0].doi).toBe(invalidDoi);

    expect(mockEnv.DOIS.put).toHaveBeenCalledWith(
      DOI_CONFIG.DOI_LIST_KEY,
      JSON.stringify([existingDoi, newValidDoi, normalizedPrefixedDoi])
    );
  });

  it('should handle an empty list of DOIs', async () => {
    mockEnv.DOIS.get.mockResolvedValue(JSON.stringify(['10.1000/xyz123'])); // Existing DOIs

    const request = new Request('http://localhost/add-doi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
      },
      body: JSON.stringify({ dois: [] }),
    });

    const response = await worker.fetch(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe('No DOIs provided to add.');
    // DOIS.put should not be called if no DOIs were provided to add.
    expect(mockEnv.DOIS.put).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid JSON format (not an array)', async () => {
    const request = new Request('http://localhost/add-doi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
      },
      body: JSON.stringify({ dois: 'not-an-array' }), // Invalid format
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(400); // Assuming ValidationError results in 400
    const body = await response.json();
    expect(body.error.message).toBe(
      "Request body must contain a 'dois' array or a single 'doi' string."
    );
    expect(mockEnv.DOIS.put).not.toHaveBeenCalled();
  });

  it('should return 400 for malformed JSON in request body', async () => {
    const request = new Request('http://localhost/add-doi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
      },
      body: '{"dois": ["10.123/abc"]', // Malformed JSON
    });

    const response = await worker.fetch(request, mockEnv);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toBe('Invalid JSON in request body');
    expect(mockEnv.DOIS.put).not.toHaveBeenCalled();
  });
});
