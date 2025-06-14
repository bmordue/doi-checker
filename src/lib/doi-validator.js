/**
 * DOI Validator
 * Validates Digital Object Identifier (DOI) format and structure
 */

/**
 * Validates if a string is in valid DOI format
 * @param {string} doi - The DOI string to validate
 * @returns {boolean} - True if the DOI format is valid
 */
export function isValidDOI(doi) {
  // Basic DOI pattern: 10.xxxx/yyyy
  return /^10\.\d{4,}\/\S+$/.test(doi);
}

/**
 * Validates a DOI and returns detailed validation results
 * @param {string} doi - The DOI string to validate
 * @returns {object} - Validation results with details
 */
export function validateDOI(doi) {
  if (!doi || typeof doi !== 'string') {
    return {
      valid: false,
      error: 'DOI must be a non-empty string'
    };
  }

  // Remove any whitespace
  const cleanDoi = doi.trim();

  // Check basic pattern
  if (!isValidDOI(cleanDoi)) {
    return {
      valid: false,
      error: 'Invalid DOI format. DOI must match pattern 10.xxxx/yyyy'
    };
  }

  return {
    valid: true,
    normalized: cleanDoi
  };
}