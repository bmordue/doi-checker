/**
 * DOI Checker Configuration Constants
 */

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
  DOI_LIST_KEY: 'doi-list'
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
  SUCCESS_CODES: [200, 201, 202, 203, 204, 205, 206, 207, 208, 226]
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
  MAX_POST_LENGTH: 500
};

// General Application Configuration
export const APP_CONFIG = {
  // Default check frequency (in cron format)
  DEFAULT_CHECK_CRON: '0 9 * * *', // 9 AM UTC daily
  
  // Debug mode
  DEBUG: false
};