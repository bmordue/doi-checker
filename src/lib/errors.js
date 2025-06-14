/**
 * Error Handling Utilities
 * Custom error classes and utilities for consistent error handling
 */

/**
 * Base class for application-specific errors
 */
export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = options.status || 500;
    this.code = options.code || 'INTERNAL_ERROR';
    this.context = options.context || {};
    this.cause = options.cause;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Format the error for API response
   * @returns {Object} - Error response object
   */
  toResponse() {
    return {
      error: {
        message: this.message,
        code: this.code,
        ...(process.env.NODE_ENV !== 'production' ? { context: this.context } : {})
      }
    };
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends AppError {
  constructor(message, options = {}) {
    super(message, { 
      status: 400, 
      code: 'VALIDATION_ERROR',
      ...options 
    });
  }
}

/**
 * Error for not found resources
 */
export class NotFoundError extends AppError {
  constructor(message, options = {}) {
    super(message || 'Resource not found', { 
      status: 404, 
      code: 'NOT_FOUND',
      ...options 
    });
  }
}

/**
 * Error for external service failures
 */
export class ExternalServiceError extends AppError {
  constructor(message, options = {}) {
    super(message, { 
      status: 502, 
      code: 'EXTERNAL_SERVICE_ERROR',
      ...options 
    });
  }
}

/**
 * Wraps a function to handle errors consistently
 * @param {Function} fn - The function to wrap
 * @returns {Function} - Wrapped function with error handling
 */
export function withErrorHandling(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      // If it's already an AppError, pass it through
      if (error instanceof AppError) {
        throw error;
      }
      
      // Otherwise, wrap it in an AppError
      throw new AppError(error.message, {
        cause: error,
        context: { args: args.map(arg => String(arg).substring(0, 100)) }
      });
    }
  };
}

/**
 * Create a standard error response
 * @param {Error} error - The error to format
 * @returns {Response} - Formatted error response
 */
export function createErrorResponse(error) {
  const status = error instanceof AppError ? error.status : 500;
  const body = error instanceof AppError 
    ? error.toResponse()
    : { error: { message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' } };
  
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Format an error for logging
 * @param {Error} error - The error to format
 * @returns {Object} - Formatted error object for logging
 */
export function formatErrorForLogging(error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error instanceof AppError ? { 
      status: error.status,
      code: error.code,
      context: error.context
    } : {}),
    ...(error.cause ? { cause: formatErrorForLogging(error.cause) } : {})
  };
}

/**
 * Safe JSON parse with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {string} errorMessage - Custom error message
 * @returns {Object} - Parsed object
 * @throws {ValidationError} - If parsing fails
 */
export function safeJsonParse(jsonString, errorMessage = 'Invalid JSON') {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new ValidationError(errorMessage, { cause: error });
  }
}