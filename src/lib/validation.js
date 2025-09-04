/**
 * Input validation and sanitization utilities
 */

import { ValidationError } from './errors.js';

/**
 * Validate and sanitize request body for add-doi endpoint
 * @param {any} body - Raw request body
 * @returns {Object} Validated request data
 * @throws {ValidationError} If validation fails
 */
export function validateAddDOIRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a valid JSON object');
  }

  // Handle both array format and single DOI format
  let dois = [];

  if (body.dois && Array.isArray(body.dois)) {
    dois = body.dois;
  } else if (body.doi && typeof body.doi === 'string') {
    dois = [body.doi];
  } else {
    throw new ValidationError("Request body must contain a 'dois' array or a single 'doi' string.");
  }

  // Validate DOI array
  if (!Array.isArray(dois)) {
    throw new ValidationError("'dois' must be an array");
  }

  if (dois.length === 0) {
    return { dois: [], isEmpty: true };
  }

  if (dois.length > 100) {
    throw new ValidationError('Maximum 100 DOIs allowed per request');
  }

  // Validate each DOI is a string
  for (let i = 0; i < dois.length; i++) {
    const doi = dois[i];
    if (typeof doi !== 'string') {
      throw new ValidationError(`DOI at index ${i} must be a string`);
    }

    if (doi.length === 0) {
      throw new ValidationError(`DOI at index ${i} cannot be empty`);
    }

    if (doi.length > 500) {
      throw new ValidationError(`DOI at index ${i} exceeds maximum length of 500 characters`);
    }

    // Basic sanitization - trim whitespace
    dois[i] = doi.trim();
  }

  return { dois };
}

/**
 * Validate and sanitize request body for remove-doi endpoint
 * @param {any} body - Raw request body
 * @returns {Object} Validated request data
 * @throws {ValidationError} If validation fails
 */
export function validateRemoveDOIRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a valid JSON object');
  }

  if (!body.doi || typeof body.doi !== 'string') {
    throw new ValidationError("Request body must contain a 'doi' string");
  }

  const doi = body.doi.trim();

  if (doi.length === 0) {
    throw new ValidationError('DOI cannot be empty');
  }

  if (doi.length > 500) {
    throw new ValidationError('DOI exceeds maximum length of 500 characters');
  }

  return { doi };
}

/**
 * Validate request rate limiting headers and content
 * @param {Request} request - HTTP request object
 * @throws {ValidationError} If request appears suspicious
 */
export function validateRequestSafety(request) {
  const contentLength = request.headers.get('content-length');
  const contentType = request.headers.get('content-type');

  // Check content length limits
  if (contentLength && parseInt(contentLength) > 10000) {
    throw new ValidationError('Request body too large (max 10KB)');
  }

  // Validate content type for POST requests
  if (request.method === 'POST' && (!contentType || !contentType.includes('application/json'))) {
    throw new ValidationError('Content-Type must be application/json for POST requests');
  }

  // Basic user agent check (be lenient for test environments)
  const userAgent = request.headers.get('user-agent');
  if (!userAgent && !request.headers.get('x-test-request')) {
    throw new ValidationError('Valid User-Agent header required');
  }
}

/**
 * Sanitize string input by removing potentially harmful characters
 * @param {string} input - Input string to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized string
 */
export function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters  // eslint-disable-line no-control-regex
    .substring(0, maxLength);
}

/**
 * Basic rate limiting check (simple in-memory implementation)
 * In production, this should use a more robust solution like Redis
 */
class SimpleRateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  checkLimit(clientId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Clean old entries
    for (const [id, timestamps] of this.requests) {
      this.requests.set(
        id,
        timestamps.filter((t) => t > windowStart)
      );
      if (this.requests.get(id).length === 0) {
        this.requests.delete(id);
      }
    }

    // Check current client
    const clientRequests = this.requests.get(clientId) || [];
    if (clientRequests.length >= this.maxRequests) {
      return false;
    }

    // Record this request
    clientRequests.push(now);
    this.requests.set(clientId, clientRequests);

    return true;
  }

  getRemainingRequests(clientId) {
    const clientRequests = this.requests.get(clientId) || [];
    return Math.max(0, this.maxRequests - clientRequests.length);
  }
}

// Global rate limiter instance
export const rateLimiter = new SimpleRateLimiter();
