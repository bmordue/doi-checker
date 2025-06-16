/**
 * DOI Validator
 * Validates Digital Object Identifier (DOI) format and structure
 */

import logger from './logger.js';
import { ValidationError } from './errors.js';

// Initialize module logger
const log = logger.createScopedLogger('doi-validator');

// DOI regex patterns
const DOI_PATTERNS = {
  // Basic pattern: 10.xxxx/yyyy
  BASIC: /^10\.\d{4,}\/\S+$/,
  
  // Strict pattern with more validation
  STRICT: /^10\.\d{4,}\/[a-zA-Z0-9()[\]:.;\-_/]+$/,
  
  // Leading DOI prefix (remove if present)
  PREFIX: /^(?:doi:|https?:\/\/(?:dx\.)?doi\.org\/)(10\..+)$/i
};

/**
 * Clean and normalize a DOI string
 * @param {string} doi - The DOI string to normalize
 * @returns {string} - Normalized DOI string
 */
export function normalizeDOI(doi) {
  if (!doi) return '';
  
  // Trim whitespace
  let normalizedDOI = doi.trim();
  
  // Remove DOI prefix if present
  const prefixMatch = normalizedDOI.match(DOI_PATTERNS.PREFIX);
  if (prefixMatch) {
    normalizedDOI = prefixMatch[1];
  }
  
  return normalizedDOI;
}

/**
 * Validates if a string is in valid DOI format
 * @param {string} doi - The DOI string to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Whether to use strict validation
 * @returns {boolean} - True if the DOI format is valid
 */
export function isValidDOI(doi, options = {}) {
  if (!doi) return false;
  
  const normalizedDOI = normalizeDOI(doi);
  const pattern = options.strict ? DOI_PATTERNS.STRICT : DOI_PATTERNS.BASIC;
  
  return pattern.test(normalizedDOI);
}

/**
 * Validates a DOI and returns detailed validation results
 * @param {string} doi - The DOI string to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Whether to use strict validation
 * @param {boolean} options.throwOnError - Whether to throw an error on validation failure
 * @returns {object} - Validation results with details
 * @throws {ValidationError} - If validation fails and throwOnError is true
 */
export function validateDOI(doi, options = {}) {
  log.debug(`Validating DOI: ${doi}`);
  
  if (!doi || typeof doi !== 'string') {
    const error = 'DOI must be a non-empty string';
    log.warn(error, { doi });
    
    if (options.throwOnError) {
      throw new ValidationError(error);
    }
    
    return {
      valid: false,
      error
    };
  }

  // Normalize the DOI
  const normalizedDOI = normalizeDOI(doi);
  
  // Check if normalization yielded an empty string
  if (!normalizedDOI) {
    const error = 'DOI is empty after normalization';
    log.warn(error, { doi, normalizedDOI });
    
    if (options.throwOnError) {
      throw new ValidationError(error);
    }
    
    return {
      valid: false,
      error
    };
  }
  
  // Check basic pattern
  const pattern = options.strict ? DOI_PATTERNS.STRICT : DOI_PATTERNS.BASIC;
  if (!pattern.test(normalizedDOI)) {
    const patternType = options.strict ? 'strict' : 'basic';
    const error = `Invalid DOI format. DOI must match ${patternType} pattern: 10.xxxx/yyyy`;
    log.warn(error, { doi, normalizedDOI, patternType });
    
    if (options.throwOnError) {
      throw new ValidationError(error);
    }
    
    return {
      valid: false,
      error
    };
  }
  
  log.debug(`DOI validation successful: ${normalizedDOI}`);
  return {
    valid: true,
    normalized: normalizedDOI,
    original: doi
  };
}

/**
 * Parse a DOI into its components
 * @param {string} doi - The DOI to parse
 * @returns {Object} - Parsed DOI components
 * @throws {ValidationError} - If DOI is invalid
 */
export function parseDOI(doi) {
  const validation = validateDOI(doi, { throwOnError: true });
  const normalizedDOI = validation.normalized;
  
  // Split the DOI into prefix and suffix
  const [prefix, ...suffixParts] = normalizedDOI.split('/');
  const suffix = suffixParts.join('/');
  
  // Extract the registry number from the prefix
  const registryNumber = prefix.replace(/^10\./, '');
  
  return {
    doi: normalizedDOI,
    prefix,
    suffix,
    registryNumber,
    url: `https://doi.org/${normalizedDOI}`
  };
}

export default {
  normalizeDOI,
  isValidDOI,
  validateDOI,
  parseDOI
};
