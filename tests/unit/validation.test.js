/**
 * Tests for input validation and sanitization utilities
 */

import { describe, test, expect } from 'vitest';
import {
  validateAddDOIRequest,
  validateRemoveDOIRequest,
  validateRequestSafety,
  sanitizeString,
  rateLimiter,
} from '../../src/lib/validation.js';
import { ValidationError } from '../../src/lib/errors.js';

describe('validateAddDOIRequest', () => {
  test('should validate valid DOI array request', () => {
    const body = { dois: ['10.1000/test', '10.1001/example'] };
    const result = validateAddDOIRequest(body);

    expect(result.dois).toEqual(['10.1000/test', '10.1001/example']);
    expect(result.isEmpty).toBeUndefined();
  });

  test('should validate single DOI request', () => {
    const body = { doi: '10.1000/single' };
    const result = validateAddDOIRequest(body);

    expect(result.dois).toEqual(['10.1000/single']);
  });

  test('should handle empty DOI array', () => {
    const body = { dois: [] };
    const result = validateAddDOIRequest(body);

    expect(result.dois).toEqual([]);
    expect(result.isEmpty).toBe(true);
  });

  test('should trim whitespace from DOIs', () => {
    const body = { dois: ['  10.1000/test  ', '\t10.1001/example\n'] };
    const result = validateAddDOIRequest(body);

    expect(result.dois).toEqual(['10.1000/test', '10.1001/example']);
  });

  test('should throw error for invalid request body', () => {
    expect(() => validateAddDOIRequest(null)).toThrow(ValidationError);
    expect(() => validateAddDOIRequest('string')).toThrow(ValidationError);
    expect(() => validateAddDOIRequest({})).toThrow(ValidationError);
  });

  test('should throw error for non-array dois', () => {
    const body = { dois: 'not-an-array' };
    expect(() => validateAddDOIRequest(body)).toThrow(ValidationError);
  });

  test('should throw error for too many DOIs', () => {
    const dois = Array(101).fill('10.1000/test');
    const body = { dois };
    expect(() => validateAddDOIRequest(body)).toThrow(ValidationError);
  });

  test('should throw error for non-string DOI', () => {
    const body = { dois: ['10.1000/valid', 123, '10.1001/valid'] };
    expect(() => validateAddDOIRequest(body)).toThrow(ValidationError);
  });

  test('should throw error for empty DOI string', () => {
    const body = { dois: ['10.1000/valid', '', '10.1001/valid'] };
    expect(() => validateAddDOIRequest(body)).toThrow(ValidationError);
  });

  test('should throw error for too long DOI', () => {
    const longDoi = '10.1000/' + 'x'.repeat(500);
    const body = { dois: [longDoi] };
    expect(() => validateAddDOIRequest(body)).toThrow(ValidationError);
  });
});

describe('validateRemoveDOIRequest', () => {
  test('should validate valid remove request', () => {
    const body = { doi: '10.1000/test' };
    const result = validateRemoveDOIRequest(body);

    expect(result.doi).toBe('10.1000/test');
  });

  test('should trim whitespace from DOI', () => {
    const body = { doi: '  10.1000/test  ' };
    const result = validateRemoveDOIRequest(body);

    expect(result.doi).toBe('10.1000/test');
  });

  test('should throw error for missing DOI', () => {
    expect(() => validateRemoveDOIRequest({})).toThrow(ValidationError);
    expect(() => validateRemoveDOIRequest({ doi: null })).toThrow(ValidationError);
  });

  test('should throw error for non-string DOI', () => {
    const body = { doi: 123 };
    expect(() => validateRemoveDOIRequest(body)).toThrow(ValidationError);
  });

  test('should throw error for empty DOI', () => {
    const body = { doi: '   ' };
    expect(() => validateRemoveDOIRequest(body)).toThrow(ValidationError);
  });

  test('should throw error for too long DOI', () => {
    const longDoi = '10.1000/' + 'x'.repeat(500);
    const body = { doi: longDoi };
    expect(() => validateRemoveDOIRequest(body)).toThrow(ValidationError);
  });
});

describe('validateRequestSafety', () => {
  test('should pass for valid request', () => {
    const request = new Request('http://test.com', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '100',
        'user-agent': 'Test Agent',
      },
    });

    expect(() => validateRequestSafety(request)).not.toThrow();
  });

  test('should throw error for too large content', () => {
    const request = new Request('http://test.com', {
      method: 'POST',
      headers: {
        'content-length': '20000',
        'user-agent': 'Test Agent',
      },
    });

    expect(() => validateRequestSafety(request)).toThrow('Request body too large');
  });

  test('should throw error for invalid content type', () => {
    const request = new Request('http://test.com', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'user-agent': 'Test Agent',
      },
    });

    expect(() => validateRequestSafety(request)).toThrow('Content-Type must be application/json');
  });

  test('should throw error for missing user agent', () => {
    const request = new Request('http://test.com', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(() => validateRequestSafety(request)).toThrow('Valid User-Agent header required');
  });

  test('should pass with test header even without user agent', () => {
    const request = new Request('http://test.com', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-request': 'true',
      },
    });

    expect(() => validateRequestSafety(request)).not.toThrow();
  });
});

describe('sanitizeString', () => {
  test('should trim whitespace', () => {
    expect(sanitizeString('  test  ')).toBe('test');
  });

  test('should remove control characters', () => {
    const input = 'test\x00\x08\x0B\x0C\x0E\x1F\x7Fstring';
    expect(sanitizeString(input)).toBe('teststring');
  });

  test('should limit length', () => {
    const input = 'a'.repeat(2000);
    expect(sanitizeString(input, 100)).toHaveLength(100);
  });

  test('should handle non-string input', () => {
    expect(sanitizeString(123)).toBe('');
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
  });
});

describe('rateLimiter', () => {
  test('should allow requests within limit', () => {
    const clientId = 'test-client-1';

    // Should allow multiple requests within limit
    for (let i = 0; i < 50; i++) {
      expect(rateLimiter.checkLimit(clientId)).toBe(true);
    }
  });

  test('should block requests over limit', () => {
    const clientId = 'test-client-2';

    // Fill up the limit
    for (let i = 0; i < 100; i++) {
      rateLimiter.checkLimit(clientId);
    }

    // Next request should be blocked
    expect(rateLimiter.checkLimit(clientId)).toBe(false);
  });

  test('should track remaining requests', () => {
    const clientId = 'test-client-3';

    // Make some requests
    for (let i = 0; i < 10; i++) {
      rateLimiter.checkLimit(clientId);
    }

    expect(rateLimiter.getRemainingRequests(clientId)).toBe(90);
  });

  test('should handle different clients separately', () => {
    const client1 = 'test-client-4';
    const client2 = 'test-client-5';

    // Fill up client1's limit
    for (let i = 0; i < 100; i++) {
      rateLimiter.checkLimit(client1);
    }

    // Client2 should still have full limit
    expect(rateLimiter.checkLimit(client2)).toBe(true);
    expect(rateLimiter.getRemainingRequests(client2)).toBe(99);
  });
});
