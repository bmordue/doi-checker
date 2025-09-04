/**
 * DOI Checker Configuration Constants
 */

import { LOG_LEVELS } from '../lib/logger.js';

// DOI Configuration
export const DOI_CONFIG = {
  // Base URL for resolving DOIs
  BASE_URL: 'https://doi.org/',

  // User agent to use for requests
  USER_AGENT: 'DOI-Checker/1.0',

  // Maximum number of retries for failed checks
  MAX_RETRIES: 3,

  // Delay between retries in milliseconds
  RETRY_DELAY: 1000,

  // KV namespace key for storing the DOI list
  DOI_LIST_KEY: 'doi-list',
};

// HTTP Client Configuration
export const HTTP_CONFIG = {
  // Timeout for HTTP requests in milliseconds
  TIMEOUT: 10000,

  // Whether to follow redirects
  FOLLOW_REDIRECTS: true,

  // Maximum number of redirects to follow
  MAX_REDIRECTS: 5,

  // HTTP status codes considered successful
  SUCCESS_CODES: [200, 201, 202, 203, 204, 205, 206, 207, 208, 226],
};

// ActivityPub Configuration
export const ACTIVITYPUB_CONFIG = {
  // Default endpoint template (to be filled with actual URL from env)
  ENDPOINT_TEMPLATE: '/api/note',

  // Content type for ActivityPub posts
  CONTENT_TYPE: 'application/json',

  // Whether to enable ActivityPub posting by default
  ENABLED_BY_DEFAULT: true,

  // Maximum length of a single ActivityPub post
  MAX_POST_LENGTH: 500,

  // Maximum number of retries for ActivityPub posting
  MAX_RETRIES: 3,

  // Delay between retries in milliseconds
  RETRY_DELAY: 2000,
};

// Logging Configuration
export const LOGGING_CONFIG = {
  // Default minimum log level
  DEFAULT_MIN_LEVEL: LOG_LEVELS.INFO,

  // Whether to include timestamps in logs
  INCLUDE_TIMESTAMPS: true,

  // Whether to include context information in logs
  INCLUDE_CONTEXT: true,

  // Enable colorized output
  COLORIZE: true,

  // Log levels for specific modules (override default)
  MODULE_LEVELS: {
    worker: LOG_LEVELS.INFO,
    'doi-validator': LOG_LEVELS.INFO,
    checker: LOG_LEVELS.INFO,
    activitypub: LOG_LEVELS.INFO,
  },
};

// Error Handling Configuration
export const ERROR_CONFIG = {
  // Whether to include stack traces in error responses
  INCLUDE_STACK_TRACES: true,

  // Whether to include error context in responses
  INCLUDE_ERROR_CONTEXT: true,

  // Default error message for generic errors
  DEFAULT_ERROR_MESSAGE: 'An unexpected error occurred',

  // Maximum number of nested errors to include in logs
  MAX_NESTED_ERRORS: 3,
};

// General Application Configuration
export const APP_CONFIG = {
  // Default check frequency (in cron format)
  DEFAULT_CHECK_CRON: '0 9 * * *', // 9 AM UTC daily

  // Debug mode
  DEBUG: true,

  // Application version
  VERSION: '1.0.0',

  // Application name
  NAME: 'DOI Checker',
};
